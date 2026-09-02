package com.videotagger.videosource;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Selector;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@ConditionalOnProperty(prefix = "videotagger.video-sources.web-selector", name = "enabled", havingValue = "true")
public class WebSelectorVideoSourceProvider implements VideoSourceProvider {
    private final String providerId;
    private final String displayName;
    private final String searchUrlTemplate;
    private final String resultSelector;
    private final String resultTitleSelector;
    private final String resultLinkSelector;
    private final String episodeSelector;
    private final String episodeTitleSelector;
    private final String episodeLinkSelector;
    private final String mediaSelector;
    private final String mediaAttribute;
    private final int maxResults;
    private final ProviderHttpClient http;

    public WebSelectorVideoSourceProvider(
            @Value("${videotagger.video-sources.web-selector.id:web-selector}") String providerId,
            @Value("${videotagger.video-sources.web-selector.display-name:Web Selector}") String displayName,
            @Value("${videotagger.video-sources.web-selector.base-url}") String baseUrl,
            @Value("${videotagger.video-sources.web-selector.search-url-template}") String searchUrlTemplate,
            @Value("${videotagger.video-sources.web-selector.result-selector}") String resultSelector,
            @Value("${videotagger.video-sources.web-selector.result-title-selector}") String resultTitleSelector,
            @Value("${videotagger.video-sources.web-selector.result-link-selector}") String resultLinkSelector,
            @Value("${videotagger.video-sources.web-selector.episode-selector}") String episodeSelector,
            @Value("${videotagger.video-sources.web-selector.episode-title-selector}") String episodeTitleSelector,
            @Value("${videotagger.video-sources.web-selector.episode-link-selector}") String episodeLinkSelector,
            @Value("${videotagger.video-sources.web-selector.media-selector:}") String mediaSelector,
            @Value("${videotagger.video-sources.web-selector.media-attribute:src}") String mediaAttribute,
            @Value("${videotagger.video-sources.web-selector.timeout-ms:10000}") int timeoutMs,
            @Value("${videotagger.video-sources.web-selector.max-results:20}") int maxResults) {
        this(providerId, displayName, baseUrl, searchUrlTemplate,
                resultSelector, resultTitleSelector, resultLinkSelector,
                episodeSelector, episodeTitleSelector, episodeLinkSelector,
                mediaSelector, mediaAttribute, timeoutMs, maxResults, false);
    }

    public WebSelectorVideoSourceProvider(String providerId, String displayName,
                                   String baseUrl, String searchUrlTemplate,
                                   String resultSelector, String resultTitleSelector,
                                   String resultLinkSelector, String episodeSelector,
                                   String episodeTitleSelector, String episodeLinkSelector,
                                   String mediaSelector, String mediaAttribute,
                                   int timeoutMs, int maxResults,
                                   boolean allowPrivateNetwork) {
        new VideoSourceProviderConfig(providerId, true, baseUrl, 0, timeoutMs,
                1, 300, mediaSelector != null && !mediaSelector.isBlank(),
                false, null, null, null);
        if (searchUrlTemplate == null || !searchUrlTemplate.contains("{keyword}")) {
            throw new IllegalArgumentException("Web Selector search template must contain {keyword}");
        }
        validateSelector(resultSelector);
        validateSelector(resultTitleSelector);
        validateSelector(resultLinkSelector);
        validateSelector(episodeSelector);
        validateSelector(episodeTitleSelector);
        validateSelector(episodeLinkSelector);
        if (mediaSelector != null && !mediaSelector.isBlank()) validateSelector(mediaSelector);
        if (mediaAttribute == null || !mediaAttribute.matches("[A-Za-z_:][A-Za-z0-9_:.\\-]*")) {
            throw new IllegalArgumentException("Web Selector media attribute is invalid");
        }
        this.providerId = providerId;
        this.displayName = displayName;
        this.searchUrlTemplate = searchUrlTemplate;
        this.resultSelector = resultSelector;
        this.resultTitleSelector = resultTitleSelector;
        this.resultLinkSelector = resultLinkSelector;
        this.episodeSelector = episodeSelector;
        this.episodeTitleSelector = episodeTitleSelector;
        this.episodeLinkSelector = episodeLinkSelector;
        this.mediaSelector = mediaSelector;
        this.mediaAttribute = mediaAttribute;
        this.maxResults = Math.max(1, Math.min(maxResults, 100));
        this.http = new ProviderHttpClient(providerId, baseUrl, timeoutMs, allowPrivateNetwork);
    }

    @Override
    public String id() {
        return providerId;
    }

    @Override
    public VideoSourceProviderCapabilities capabilities() {
        Set<VideoSourceStatus.Capability> values;
        if (mediaSelector == null || mediaSelector.isBlank()) {
            values = Set.of(
                    VideoSourceStatus.Capability.DISCOVER_PACKAGES,
                    VideoSourceStatus.Capability.PACKAGE_DETAILS,
                    VideoSourceStatus.Capability.REFRESH_PACKAGE,
                    VideoSourceStatus.Capability.SOURCE_PAGE);
        } else {
            values = Set.of(
                    VideoSourceStatus.Capability.DISCOVER_PACKAGES,
                    VideoSourceStatus.Capability.PACKAGE_DETAILS,
                    VideoSourceStatus.Capability.REFRESH_PACKAGE,
                    VideoSourceStatus.Capability.SOURCE_PAGE,
                    VideoSourceStatus.Capability.RESOLVE_PLAYBACK,
                    VideoSourceStatus.Capability.PROBE,
                    VideoSourceStatus.Capability.DOWNLOAD);
        }
        return new VideoSourceProviderCapabilities(id(), displayName, values, maxResults);
    }

    @Override
    public List<VideoSourcePackage> discover(VideoSourceDiscoveryQuery query) {
        String keyword = query.titles().stream()
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElseThrow(() -> new VideoSourceProviderException(
                        id(), "MISSING_TITLE", "Web discovery requires a title", false));
        Document document = fetch(searchUrlTemplate.replace(
                "{keyword}", VideoSourceText.urlEncode(keyword)));
        List<VideoSourcePackage> packages = new ArrayList<>();
        for (Element result : document.select(resultSelector)) {
            if (packages.size() >= Math.min(query.limit(), maxResults)) break;
            Element titleElement = result.selectFirst(resultTitleSelector);
            Element linkElement = result.selectFirst(resultLinkSelector);
            if (titleElement == null || linkElement == null) continue;
            String detailUrl = absolute(linkElement, "href");
            packages.add(fetchPackage(detailUrl, titleElement.text()));
        }
        return packages;
    }

    @Override
    public VideoSourcePackage getPackage(String providerPackageId, String revision) {
        return fetchPackage(VideoSourceText.decodeIdentity(providerPackageId), null);
    }

    private VideoSourcePackage fetchPackage(String detailUrl, String discoveredTitle) {
        Document document = fetch(detailUrl);
        List<VideoSourceItem> items = new ArrayList<>();
        String packageId = VideoSourceText.encodeIdentity(detailUrl);
        for (Element episode : document.select(episodeSelector)) {
            Element titleElement = episode.selectFirst(episodeTitleSelector);
            Element linkElement = episode.selectFirst(episodeLinkSelector);
            if (titleElement == null || linkElement == null) continue;
            String episodeUrl = absolute(linkElement, "href");
            String title = titleElement.text();
            String itemId = VideoSourceText.encodeIdentity(episodeUrl);
            Set<VideoSourceStatus.Capability> itemCapabilities;
            if (mediaSelector == null || mediaSelector.isBlank()) {
                itemCapabilities = Set.of(VideoSourceStatus.Capability.SOURCE_PAGE);
            } else {
                itemCapabilities = Set.of(
                        VideoSourceStatus.Capability.SOURCE_PAGE,
                        VideoSourceStatus.Capability.RESOLVE_PLAYBACK,
                        VideoSourceStatus.Capability.PROBE,
                        VideoSourceStatus.Capability.DOWNLOAD);
            }
            items.add(new VideoSourceItem(id(), packageId, itemId,
                    VideoSourceText.hash(episodeUrl + title),
                    VideoSourceStatus.ItemKind.EPISODE,
                    VideoSourceText.episodeNumber(title), null, title, null,
                    List.of(), List.of(), null, itemCapabilities,
                    episodeUrl, Map.of("pageUrl", episodeUrl)));
        }
        String title = discoveredTitle == null || discoveredTitle.isBlank()
                ? document.title() : discoveredTitle;
        String revision = VideoSourceText.hash(items.stream()
                .map(VideoSourceItem::stableIdentity).reduce("", String::concat));
        return new VideoSourcePackage(id(), packageId, revision, title,
                displayName, null, null, "WEB_PAGE", items.size(),
                List.of(), List.of(), null, null, null,
                capabilities().capabilities(), detailUrl,
                Map.of("pageUrl", detailUrl), items);
    }

    @Override
    public VideoSourceResolution resolve(VideoSourceResolveRequest request) {
        if (mediaSelector == null || mediaSelector.isBlank()) {
            throw new VideoSourceProviderException(
                    id(), "PLAYBACK_UNSUPPORTED", "No media selector is configured", false);
        }
        String pageUrl = VideoSourceText.decodeIdentity(request.providerItemId());
        Document document = fetch(pageUrl);
        Element media = document.selectFirst(mediaSelector);
        if (media == null) {
            throw new VideoSourceProviderException(
                    id(), "MEDIA_NOT_FOUND", "Direct media element was not found", true);
        }
        String locator = absolute(media, mediaAttribute);
        RemoteResourcePolicy.validateLocator(locator, false);
        String extension = VideoSourceText.extension(locator);
        if (!(extension.equals(".mp4") || extension.equals(".webm")
                || extension.equals(".ogg") || extension.equals(".ogv"))) {
            throw new VideoSourceProviderException(
                    id(), "UNSUPPORTED_FORMAT", "Only public direct media files are supported", false);
        }
        return new VideoSourceResolution(request.providerItemId(), request.revision(),
                locator, Instant.now(), Instant.now().plus(5, ChronoUnit.MINUTES),
                mimeType(extension), null, false, pageUrl);
    }

    @Override
    public VideoSourceProbeResult probe(VideoSourceProbeRequest request) {
        VideoSourceResolution resolution = request.resolution();
        return new VideoSourceProbeResult(
                VideoSourceStatus.ProbeState.PLAYABLE, Instant.now(), false,
                "PUBLIC_DIRECT_MEDIA", "Public direct media URL resolved", "PLAY",
                resolution.mimeType(), resolution.contentLength(), null, null, null,
                VideoSourceText.extension(resolution.resolvedLocator()), null, null,
                resolution.rangeSupported());
    }

    @Override
    public VideoSourceDownloadPlan planDownload(VideoSourceDownloadRequest request) {
        VideoSourceResolution resolution = resolve(new VideoSourceResolveRequest(
                request.providerPackageId(), request.providerItemId(), request.revision(),
                VideoSourceStatus.ResolutionPurpose.DOWNLOAD, request.preferredQuality(),
                request.preferredSubtitleLanguage(), request.preferredAudioLanguage()));
        return new VideoSourceDownloadPlan(request.providerItemId(), request.revision(),
                resolution, resolution.contentLength(),
                VideoSourceText.extension(resolution.resolvedLocator()), false,
                false, resolution.expiresAt());
    }

    private Document fetch(String url) {
        ProviderHttpClient.Response response = http.get(url, Map.of());
        return Jsoup.parse(response.text(), response.uri().toString());
    }

    private String absolute(Element element, String attribute) {
        String value = element.absUrl(attribute);
        if (value.isBlank()) value = http.resolve(element.attr(attribute)).toString();
        return value;
    }

    private static String mimeType(String extension) {
        return switch (extension) {
            case ".webm" -> "video/webm";
            case ".ogg", ".ogv" -> "video/ogg";
            default -> "video/mp4";
        };
    }

    private static void validateSelector(String selector) {
        if (selector == null || selector.isBlank()) {
            throw new IllegalArgumentException("Web Selector CSS selector is required");
        }
        try {
            Selector.select(selector, new Element("div"));
        } catch (Selector.SelectorParseException e) {
            throw new IllegalArgumentException("Web Selector CSS selector is invalid", e);
        }
    }
}
