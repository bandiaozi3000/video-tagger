package com.videotagger.videosource;

import com.fasterxml.jackson.databind.JsonNode;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;

import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class AnimekoWebSelectorVideoSourceProvider implements VideoSourceProvider {
    private static final Set<String> DIRECT_EXTENSIONS = Set.of(".mp4", ".webm", ".ogg", ".ogv");
    private static final Pattern HTTP_URL = Pattern.compile("https?:(?:\\\\/|/){2}[^\\s\\\"'<>]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAGE_EPISODE = Pattern.compile("/(\\d{1,4})(?:\\.html?)?(?:\\?.*)?$", Pattern.CASE_INSENSITIVE);
    private static final Pattern MEDIA_EPISODE = Pattern.compile("/(\\d{1,4})\\.(?:mp4|webm|ogg|ogv)(?:\\?.*)?$", Pattern.CASE_INSENSITIVE);

    private final String providerId;
    private final String displayName;
    private final JsonNode searchConfig;
    private final String searchUrlTemplate;
    private final int maxResults;
    private final ProviderHttpClient http;

    public AnimekoWebSelectorVideoSourceProvider(String providerId, String displayName,
                                                  JsonNode arguments, int timeoutMs, int maxResults) {
        this(providerId, displayName, arguments, timeoutMs, maxResults, false);
    }

    AnimekoWebSelectorVideoSourceProvider(String providerId, String displayName,
                                          JsonNode arguments, int timeoutMs, int maxResults,
                                          boolean allowPrivateNetwork) {
        if (arguments == null || !arguments.isObject()) throw new IllegalArgumentException("Web Selector 配置为空");
        this.searchConfig = arguments.path("searchConfig");
        this.searchUrlTemplate = text(searchConfig, "searchUrl");
        if (!searchUrlTemplate.contains("{keyword}")) throw new IllegalArgumentException("搜索地址必须包含 {keyword}");
        URI searchUri = URI.create(searchUrlTemplate.replace("{keyword}", "test"));
        String baseUrl = searchUri.getScheme() + "://" + searchUri.getAuthority();
        this.providerId = providerId;
        this.displayName = displayName;
        this.maxResults = Math.max(1, Math.min(maxResults, 100));
        this.http = new ProviderHttpClient(providerId, baseUrl, timeoutMs, allowPrivateNetwork);
        validateConfiguration();
    }

    @Override
    public String id() {
        return providerId;
    }

    @Override
    public VideoSourceProviderCapabilities capabilities() {
        return new VideoSourceProviderCapabilities(id(), displayName, Set.of(
                VideoSourceStatus.Capability.DISCOVER_PACKAGES,
                VideoSourceStatus.Capability.PACKAGE_DETAILS,
                VideoSourceStatus.Capability.REFRESH_PACKAGE,
                VideoSourceStatus.Capability.SOURCE_PAGE,
                VideoSourceStatus.Capability.RESOLVE_PLAYBACK,
                VideoSourceStatus.Capability.PROBE), maxResults);
    }

    @Override
    public List<VideoSourcePackage> discover(VideoSourceDiscoveryQuery query) {
        List<String> titles = query.titles().stream().filter(value -> value != null && !value.isBlank()).distinct().toList();
        if (titles.isEmpty()) throw new VideoSourceProviderException(id(), "MISSING_TITLE", "网页源搜索需要作品标题", false);
        boolean firstWord = searchConfig.path("searchUseOnlyFirstWord").asBoolean(false);
        boolean removeSpecial = searchConfig.path("searchRemoveSpecial").asBoolean(false);
        LinkedHashMap<String, SearchResult> discovered = new LinkedHashMap<>();
        RuntimeException lastError = null;
        for (String title : titles) {
            String keyword = VideoSourceTitleMatcher.searchKeyword(title, removeSpecial, firstWord);
            if (keyword.isBlank()) continue;
            try {
                Document document = fetch(searchUrlTemplate.replace("{keyword}", VideoSourceText.urlEncode(keyword)));
                for (SearchResult result : searchResults(document)) discovered.putIfAbsent(result.url(), result);
            } catch (RuntimeException error) {
                lastError = error;
            }
        }
        if (discovered.isEmpty() && lastError != null) throw lastError;
        int minimumTitleScore = titles.stream().anyMatch(title -> title.length() <= 3) ? 72 : 60;
        List<SearchResult> results = discovered.values().stream()
                .filter(result -> titleScore(titles, result.title()) >= minimumTitleScore)
                .sorted(Comparator.comparingInt((SearchResult result) -> titleScore(titles, result.title())).reversed())
                .toList();
        List<VideoSourcePackage> packages = new ArrayList<>();
        int limit = Math.min(Math.min(Math.max(1, query.limit()), maxResults), 12);
        for (SearchResult result : results) {
            if (packages.size() >= limit) break;
            try {
                packages.add(packageFrom(result.url(), result.title()));
            } catch (RuntimeException ignored) {
            }
        }
        return packages;
    }

    private static int titleScore(List<String> titles, String candidate) {
        return titles.stream().mapToInt(title -> VideoSourceTitleMatcher.score(title, candidate)).max().orElse(0);
    }

    @Override
    public VideoSourcePackage getPackage(String providerPackageId, String revision) {
        return packageFrom(VideoSourceText.decodeIdentity(providerPackageId), null);
    }

    @Override
    public VideoSourceResolution resolve(VideoSourceResolveRequest request) {
        String pageUrl = VideoSourceText.decodeIdentity(request.providerItemId());
        String locator = resolveDirect(pageUrl, 0);
        if (locator == null) {
            throw new VideoSourceProviderException(id(), "SOURCE_PAGE_REQUIRED",
                    "未解析到浏览器可直放地址，请打开源站播放", false);
        }
        String extension = VideoSourceText.extension(locator);
        return new VideoSourceResolution(request.providerItemId(), request.revision(), locator,
                Instant.now(), Instant.now().plus(5, ChronoUnit.MINUTES), mimeType(extension),
                null, false, pageUrl);
    }

    @Override
    public VideoSourceProbeResult probe(VideoSourceProbeRequest request) {
        VideoSourceResolution resolution = request.resolution();
        return new VideoSourceProbeResult(VideoSourceStatus.ProbeState.PLAYABLE, Instant.now(), false,
                "PUBLIC_DIRECT_MEDIA", "已解析公开直放地址", "PLAY", resolution.mimeType(),
                resolution.contentLength(), null, null, null, VideoSourceText.extension(resolution.resolvedLocator()),
                null, null, resolution.rangeSupported());
    }

    @Override
    public VideoSourceDownloadPlan planDownload(VideoSourceDownloadRequest request) {
        throw new VideoSourceProviderException(id(), "DOWNLOAD_UNSUPPORTED", "订阅网页源暂不支持下载", false);
    }

    private VideoSourcePackage packageFrom(String detailUrl, String discoveredTitle) {
        Document document = fetch(detailUrl);
        String packageId = VideoSourceText.encodeIdentity(detailUrl);
        List<VideoSourceItem> items = episodes(document, packageId);
        String detailTitle = document.title();
        String title = discoveredTitle == null || discoveredTitle.isBlank() ? detailTitle : discoveredTitle;
        String revision = VideoSourceText.hash(items.stream().map(VideoSourceItem::stableIdentity).reduce("", String::concat));
        return new VideoSourcePackage(id(), packageId, revision, title, displayName, null, null,
                "WEB_PAGE", items.size(), List.of(), List.of(),
                text(searchConfig, "defaultResolution"), null, null, capabilities().capabilities(),
                detailUrl, Map.of("pageUrl", detailUrl, "detailTitle", detailTitle), items);
    }

    private List<SearchResult> searchResults(Document document) {
        String format = text(searchConfig, "subjectFormatId");
        List<SearchResult> values = new ArrayList<>();
        if ("indexed".equals(format)) {
            JsonNode config = searchConfig.path("selectorSubjectFormatIndexed");
            var names = document.select(text(config, "selectNames"));
            var links = document.select(text(config, "selectLinks"));
            for (int index = 0; index < Math.min(names.size(), links.size()); index++) {
                String url = link(links.get(index));
                if (url != null) values.add(new SearchResult(names.get(index).text(), url));
            }
        } else {
            String selector = text(searchConfig.path("selectorSubjectFormatA"), "selectLists");
            for (Element element : document.select(selector)) {
                String url = link(element);
                if (url != null) values.add(new SearchResult(title(element), url));
            }
        }
        return values;
    }

    private List<VideoSourceItem> episodes(Document document, String packageId) {
        List<VideoSourceItem> values = new ArrayList<>();
        String format = text(searchConfig, "channelFormatId");
        if ("no-channel".equals(format)) {
            JsonNode config = searchConfig.path("selectorChannelFormatNoChannel");
            addEpisodes(values, packageId, document, text(config, "selectEpisodes"),
                    text(config, "selectEpisodeLinks"), "默认线路", text(config, "matchEpisodeSortFromName"));
        } else {
            JsonNode config = searchConfig.path("selectorChannelFormatFlattened");
            var lists = document.select(text(config, "selectEpisodeLists"));
            var names = selectOptional(document, text(config, "selectChannelNames"));
            for (int index = 0; index < lists.size(); index++) {
                String channel = index < names.size() && !names.get(index).text().isBlank()
                        ? names.get(index).text() : "线路 " + (index + 1);
                addEpisodes(values, packageId, lists.get(index), text(config, "selectEpisodesFromList"),
                        text(config, "selectEpisodeLinksFromList"), channel, text(config, "matchEpisodeSortFromName"));
            }
        }
        return values;
    }

    private void addEpisodes(List<VideoSourceItem> values, String packageId, Element root,
                             String episodeSelector, String linkSelector, String channel, String episodePattern) {
        if (episodeSelector.isBlank()) return;
        var episodes = root.select(episodeSelector);
        var links = linkSelector.isBlank() ? episodes : root.select(linkSelector);
        for (int index = 0; index < Math.min(episodes.size(), links.size()); index++) {
            Element episode = episodes.get(index);
            String url = link(links.get(index));
            if (url == null) continue;
            String title = title(episode);
            Integer episodeNumber = episodeNumber(title, episodePattern);
            String itemId = VideoSourceText.encodeIdentity(url);
            int channelTier = searchConfig.path("channelTiers").path(channel).asInt(2);
            values.add(new VideoSourceItem(id(), packageId, itemId, VideoSourceText.hash(url + title + channel),
                    VideoSourceStatus.ItemKind.EPISODE, episodeNumber, null, title, null,
                    List.of(), List.of(), text(searchConfig, "defaultResolution"), Set.of(
                    VideoSourceStatus.Capability.SOURCE_PAGE,
                    VideoSourceStatus.Capability.RESOLVE_PLAYBACK,
                    VideoSourceStatus.Capability.PROBE), url, Map.of("pageUrl", url, "channel", channel,
                    "channelTier", channelTier)));
        }
    }

    private String resolveDirect(String pageUrl, int depth) {
        ProviderHttpClient.Response response = http.get(pageUrl, Map.of());
        Document document = Jsoup.parse(response.text(), response.uri().toString());
        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        for (Element element : document.select("video[src],source[src],video[data-src],source[data-src],iframe[src]")) {
            String attribute = element.hasAttr("src") ? "src" : "data-src";
            String value = element.absUrl(attribute);
            if (!value.isBlank()) candidates.add(value);
        }
        String raw = Parser.unescapeEntities(response.text(), false)
                .replace("\\/", "/").replace("\\u0026", "&");
        JsonNode matchVideo = searchConfig.path("matchVideo");
        String configuredPattern = text(matchVideo, "matchVideoUrl");
        if (!configuredPattern.isBlank()) addConfiguredMatches(candidates, raw, configuredPattern);
        Matcher matcher = HTTP_URL.matcher(raw);
        while (matcher.find() && candidates.size() < 100) candidates.add(cleanUrl(matcher.group()));
        Integer pageEpisode = pageEpisodeNumber(pageUrl);
        String fallback = null;
        boolean hasEpisodeSpecificCandidate = false;
        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) continue;
            try {
                URI uri = URI.create(candidate);
                if (!uri.isAbsolute()) continue;
                String extension = VideoSourceText.extension(candidate);
                if (DIRECT_EXTENSIONS.contains(extension)) {
                    RemoteResourcePolicy.validateLocator(candidate, false);
                    Integer mediaEpisode = mediaEpisodeNumber(candidate);
                    if (pageEpisode != null && mediaEpisode != null) {
                        hasEpisodeSpecificCandidate = true;
                        if (pageEpisode.equals(mediaEpisode)) return candidate;
                    } else if (fallback == null) {
                        fallback = candidate;
                    }
                }
            } catch (RuntimeException ignored) {
            }
        }
        if (!hasEpisodeSpecificCandidate && fallback != null) return fallback;
        if (depth == 0 && matchVideo.path("enableNestedUrl").asBoolean(false)) {
            String nestedPattern = text(matchVideo, "matchNestedUrl");
            for (String candidate : candidates) {
                if (matches(candidate, nestedPattern)) {
                    try {
                        String nested = resolveDirect(candidate, 1);
                        if (nested != null) return nested;
                    } catch (RuntimeException ignored) {
                    }
                }
            }
        }
        return null;
    }

    private static Integer pageEpisodeNumber(String pageUrl) {
        Matcher matcher = PAGE_EPISODE.matcher(URI.create(pageUrl).getPath());
        return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
    }

    private static Integer mediaEpisodeNumber(String mediaUrl) {
        Matcher matcher = MEDIA_EPISODE.matcher(URI.create(mediaUrl).getPath());
        return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
    }

    private void validateConfiguration() {
        String subjectFormat = text(searchConfig, "subjectFormatId");
        if ("indexed".equals(subjectFormat)) {
            required(searchConfig.path("selectorSubjectFormatIndexed"), "selectNames");
            required(searchConfig.path("selectorSubjectFormatIndexed"), "selectLinks");
        } else {
            required(searchConfig.path("selectorSubjectFormatA"), "selectLists");
        }
        String channelFormat = text(searchConfig, "channelFormatId");
        if ("no-channel".equals(channelFormat)) {
            required(searchConfig.path("selectorChannelFormatNoChannel"), "selectEpisodes");
        } else {
            required(searchConfig.path("selectorChannelFormatFlattened"), "selectEpisodeLists");
            required(searchConfig.path("selectorChannelFormatFlattened"), "selectEpisodesFromList");
        }
    }

    private Document fetch(String url) {
        ProviderHttpClient.Response response = http.get(url, Map.of());
        return Jsoup.parse(response.text(), response.uri().toString());
    }

    private String link(Element element) {
        Element link = element.hasAttr("href") ? element : element.selectFirst("a[href]");
        if (link == null) return null;
        String value = link.absUrl("href");
        return value.isBlank() ? http.resolve(link.attr("href")).toString() : value;
    }

    private static String title(Element element) {
        String value = element.attr("title");
        return value.isBlank() ? element.text().trim() : value.trim();
    }

    private static Integer episodeNumber(String title, String configuredPattern) {
        if (!configuredPattern.isBlank()) {
            try {
                Matcher matcher = Pattern.compile(configuredPattern, Pattern.CASE_INSENSITIVE).matcher(title);
                if (matcher.find()) {
                    String value;
                    try {
                        value = matcher.group("ep");
                    } catch (IllegalArgumentException ignored) {
                        value = matcher.groupCount() > 0 ? matcher.group(1) : matcher.group();
                    }
                    Matcher digits = Pattern.compile("\\d{1,4}").matcher(value == null ? "" : value);
                    if (digits.find()) return Integer.parseInt(digits.group());
                }
            } catch (RuntimeException ignored) {
            }
        }
        return VideoSourceText.episodeNumber(title);
    }

    private static void addConfiguredMatches(Set<String> values, String raw, String configuredPattern) {
        try {
            Matcher matcher = Pattern.compile(configuredPattern, Pattern.CASE_INSENSITIVE).matcher(raw);
            while (matcher.find() && values.size() < 100) {
                String value;
                try {
                    value = matcher.group("v");
                } catch (IllegalArgumentException ignored) {
                    value = matcher.group();
                }
                String url = firstUrl(value);
                if (url != null) values.add(url);
            }
        } catch (RuntimeException ignored) {
        }
    }

    private static String firstUrl(String value) {
        if (value == null) return null;
        Matcher matcher = HTTP_URL.matcher(value.replace("\\/", "/"));
        return matcher.find() ? cleanUrl(matcher.group()) : null;
    }

    private static String cleanUrl(String value) {
        String result = value.replace("\\/", "/");
        while (!result.isEmpty() && ")]},;\\\"'".indexOf(result.charAt(result.length() - 1)) >= 0) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }

    private static boolean matches(String value, String pattern) {
        if (value == null || pattern.isBlank()) return false;
        try {
            return Pattern.compile(pattern, Pattern.CASE_INSENSITIVE).matcher(value).find();
        } catch (RuntimeException e) {
            return false;
        }
    }

    private static List<Element> selectOptional(Element root, String selector) {
        return selector.isBlank() ? List.of() : root.select(selector);
    }

    private static String text(JsonNode node, String key) {
        return node == null ? "" : node.path(key).asText("").trim();
    }

    private static void required(JsonNode node, String key) {
        if (text(node, key).isBlank()) throw new IllegalArgumentException("Web Selector 缺少 " + key);
    }

    private static String mimeType(String extension) {
        return switch (extension) {
            case ".webm" -> "video/webm";
            case ".ogg", ".ogv" -> "video/ogg";
            default -> "video/mp4";
        };
    }

    private record SearchResult(String title, String url) {
    }
}
