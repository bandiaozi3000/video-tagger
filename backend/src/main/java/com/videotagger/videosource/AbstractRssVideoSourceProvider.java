package com.videotagger.videosource;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

abstract class AbstractRssVideoSourceProvider implements VideoSourceProvider {
    private final String providerId;
    private final String displayName;
    private final String searchUrlTemplate;
    private final int maxResults;
    private final ProviderHttpClient http;

    AbstractRssVideoSourceProvider(String providerId, String displayName, String baseUrl,
                                   String searchUrlTemplate, int timeoutMs, int maxResults,
                                   boolean allowPrivateNetwork) {
        if (searchUrlTemplate == null || !searchUrlTemplate.contains("{keyword}")) {
            throw new IllegalArgumentException("RSS search URL template must contain {keyword}");
        }
        this.providerId = providerId;
        this.displayName = displayName;
        this.searchUrlTemplate = searchUrlTemplate;
        this.maxResults = Math.max(1, Math.min(maxResults, 200));
        this.http = new ProviderHttpClient(providerId, baseUrl, timeoutMs, allowPrivateNetwork);
    }

    @Override
    public String id() {
        return providerId;
    }

    @Override
    public VideoSourceProviderCapabilities capabilities() {
        return new VideoSourceProviderCapabilities(providerId, displayName, Set.of(
                VideoSourceStatus.Capability.DISCOVER_PACKAGES,
                VideoSourceStatus.Capability.PACKAGE_DETAILS,
                VideoSourceStatus.Capability.REFRESH_PACKAGE,
                VideoSourceStatus.Capability.SOURCE_PAGE), maxResults);
    }

    @Override
    public List<VideoSourcePackage> discover(VideoSourceDiscoveryQuery query) {
        String keyword = query.titles().stream()
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElseThrow(() -> new VideoSourceProviderException(
                        id(), "MISSING_TITLE", "RSS discovery requires a title", false));
        return discoverKeyword(keyword, query.limit());
    }

    @Override
    public VideoSourcePackage getPackage(String providerPackageId, String revision) {
        String identity = VideoSourceText.decodeIdentity(providerPackageId);
        int separator = identity.indexOf('\n');
        if (separator < 0) {
            throw new VideoSourceProviderException(
                    id(), "INVALID_PACKAGE_ID", "RSS package identity is invalid", false);
        }
        String keyword = identity.substring(0, separator);
        String releaseGroup = identity.substring(separator + 1);
        return discoverKeyword(keyword, maxResults).stream()
                .filter(value -> value.releaseGroup().equals(releaseGroup))
                .findFirst()
                .orElseThrow(() -> new VideoSourceProviderException(
                        id(), "PACKAGE_NOT_FOUND", "RSS package was not found", true));
    }

    private List<VideoSourcePackage> discoverKeyword(String keyword, int requestedLimit) {
        String url = searchUrlTemplate.replace("{keyword}", VideoSourceText.urlEncode(keyword));
        int limit = Math.min(Math.max(1, requestedLimit), maxResults);
        List<RssEntry> entries = parse(http.get(url, Map.of()).body()).stream().limit(limit).toList();
        Map<String, List<RssEntry>> groups = entries.stream().collect(Collectors.groupingBy(
                entry -> VideoSourceText.releaseGroup(entry.title()), LinkedHashMap::new, Collectors.toList()));
        List<VideoSourcePackage> packages = new ArrayList<>();
        groups.forEach((releaseGroup, values) -> packages.add(toPackage(keyword, releaseGroup, values)));
        return packages;
    }

    private VideoSourcePackage toPackage(String keyword, String releaseGroup, List<RssEntry> entries) {
        String packageId = VideoSourceText.encodeIdentity(keyword + "\n" + releaseGroup);
        List<VideoSourceItem> items = entries.stream()
                .map(entry -> toItem(packageId, entry))
                .sorted(Comparator.comparing(VideoSourceItem::episodeNumber,
                        Comparator.nullsLast(Integer::compareTo)))
                .toList();
        String revision = VideoSourceText.hash(entries.stream()
                .map(RssEntry::identity).sorted().collect(Collectors.joining("|")));
        String sourcePage = entries.isEmpty() ? null : entries.get(0).link();
        return new VideoSourcePackage(id(), packageId, revision,
                keyword + " · " + releaseGroup, releaseGroup, null, null, "RSS_RELEASE",
                items.size(), List.of(), List.of(), null, null, null,
                capabilities().capabilities(), sourcePage,
                Map.of("feedType", "RSS", "keyword", keyword), items);
    }

    private VideoSourceItem toItem(String packageId, RssEntry entry) {
        Integer episode = VideoSourceText.episodeNumber(entry.title());
        String itemId = VideoSourceText.hash(entry.identity());
        Map<String, Object> snapshot = new LinkedHashMap<>();
        if (entry.enclosureUrl() != null) snapshot.put("torrentUrl", entry.enclosureUrl());
        if (entry.guid() != null) snapshot.put("guid", entry.guid());
        if (entry.infoHash() != null) snapshot.put("infoHash", entry.infoHash());
        if (entry.seeders() > 0) snapshot.put("seeders", entry.seeders());
        return new VideoSourceItem(id(), packageId, itemId,
                VideoSourceText.hash(entry.identity()), VideoSourceStatus.ItemKind.EPISODE,
                episode, null, entry.title(), null, List.of(), List.of(), null,
                Set.of(VideoSourceStatus.Capability.SOURCE_PAGE), entry.link(), snapshot);
    }

    private List<RssEntry> parse(byte[] bytes) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            Document document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
            NodeList nodes = document.getElementsByTagName("item");
            List<RssEntry> entries = new ArrayList<>();
            for (int index = 0; index < nodes.getLength(); index++) {
                Element item = (Element) nodes.item(index);
                String title = text(item, "title");
                String link = safeUrl(text(item, "link"), false);
                String guid = text(item, "guid");
                Element enclosure = firstElement(item, "enclosure");
                String enclosureUrl = enclosure == null
                        ? null : safeUrl(enclosure.getAttribute("url"), true);
                String infoHash = text(item, "nyaa:infoHash");
                int seeders = 0;
                try {
                    seeders = Integer.parseInt(String.valueOf(text(item, "nyaa:seeders")).trim());
                } catch (Exception ignored) {
                }
                if (title != null && link != null) {
                    entries.add(new RssEntry(title, link, emptyToNull(guid), enclosureUrl, infoHash, seeders));
                }
            }
            return entries;
        } catch (VideoSourceProviderException e) {
            throw e;
        } catch (Exception e) {
            throw new VideoSourceProviderException(
                    id(), "INVALID_RSS", "Provider returned invalid RSS", false, e);
        }
    }

    private String safeUrl(String raw, boolean allowMagnet) {
        if (raw == null || raw.isBlank()) return null;
        URI uri = URI.create(raw.trim());
        if (!uri.isAbsolute()) uri = http.resolve(raw.trim());
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (allowMagnet && "magnet".equals(scheme)) return uri.toString();
        if (!("http".equals(scheme) || "https".equals(scheme)) || uri.getUserInfo() != null) return null;
        return uri.toString();
    }

    private static String text(Element parent, String name) {
        Element element = firstElement(parent, name);
        return element == null ? null : emptyToNull(element.getTextContent());
    }

    private static Element firstElement(Element parent, String name) {
        NodeList nodes = parent.getElementsByTagName(name);
        if (nodes.getLength() == 0) return null;
        Node node = nodes.item(0);
        return node instanceof Element element ? element : null;
    }

    private static String emptyToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    private record RssEntry(String title, String link, String guid, String enclosureUrl, String infoHash, int seeders) {
        String identity() {
            return guid == null ? link : guid;
        }
    }

    @Override
    public VideoSourceResolution resolve(VideoSourceResolveRequest request) {
        throw new VideoSourceProviderException(
                id(), "PLAYBACK_UNSUPPORTED", "RSS torrent source is metadata-only", false);
    }

    @Override
    public VideoSourceProbeResult probe(VideoSourceProbeRequest request) {
        throw new VideoSourceProviderException(
                id(), "PLAYBACK_UNSUPPORTED", "RSS torrent source is metadata-only", false);
    }

    @Override
    public VideoSourceDownloadPlan planDownload(VideoSourceDownloadRequest request) {
        throw new VideoSourceProviderException(
                id(), "TORRENT_ENGINE_REQUIRED", "Torrent download engine is not installed", false);
    }
}
