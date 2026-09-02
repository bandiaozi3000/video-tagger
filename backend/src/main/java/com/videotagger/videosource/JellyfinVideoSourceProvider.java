package com.videotagger.videosource;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@ConditionalOnProperty(prefix = "videotagger.video-sources.jellyfin", name = "enabled", havingValue = "true")
public class JellyfinVideoSourceProvider implements VideoSourceProvider {
    private final String baseUrl;
    private final String userId;
    private final String apiKey;
    private final int maxResults;
    private final ProviderHttpClient http;
    private final ObjectMapper objectMapper;

    public JellyfinVideoSourceProvider(
            @Value("${videotagger.video-sources.jellyfin.base-url}") String baseUrl,
            @Value("${videotagger.video-sources.jellyfin.user-id}") String userId,
            @Value("${videotagger.video-sources.jellyfin.api-key}") String apiKey,
            @Value("${videotagger.video-sources.jellyfin.timeout-ms:10000}") int timeoutMs,
            @Value("${videotagger.video-sources.jellyfin.max-results:20}") int maxResults,
            @Value("${videotagger.video-sources.jellyfin.allow-private-network:false}") boolean allowPrivateNetwork,
            ObjectMapper objectMapper) {
        this(baseUrl, userId, apiKey, maxResults,
                new ProviderHttpClient("jellyfin", baseUrl, timeoutMs, allowPrivateNetwork), objectMapper);
    }

    JellyfinVideoSourceProvider(String baseUrl, String userId, String apiKey, int maxResults,
                                ProviderHttpClient http, ObjectMapper objectMapper) {
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException("Jellyfin user ID is required");
        if (apiKey == null || apiKey.isBlank()) throw new IllegalArgumentException("Jellyfin API key is required");
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.userId = userId;
        this.apiKey = apiKey;
        this.maxResults = Math.max(1, Math.min(maxResults, 100));
        this.http = http;
        this.objectMapper = objectMapper;
    }

    @Override
    public String id() {
        return "jellyfin";
    }

    @Override
    public VideoSourceProviderCapabilities capabilities() {
        return new VideoSourceProviderCapabilities(id(), "Jellyfin", Set.of(
                VideoSourceStatus.Capability.DISCOVER_PACKAGES,
                VideoSourceStatus.Capability.PACKAGE_DETAILS,
                VideoSourceStatus.Capability.REFRESH_PACKAGE,
                VideoSourceStatus.Capability.TRACK_METADATA,
                VideoSourceStatus.Capability.SOURCE_PAGE), maxResults);
    }

    @Override
    public List<VideoSourcePackage> discover(VideoSourceDiscoveryQuery query) {
        LinkedHashMap<String, VideoSourcePackage> packages = new LinkedHashMap<>();
        for (String title : query.titles()) {
            if (title == null || title.isBlank()) continue;
            String path = "/Items?userId=" + VideoSourceText.urlEncode(userId)
                    + "&recursive=true&includeItemTypes=Series&fields=ProviderIds,ProductionYear,DateLastSaved"
                    + "&limit=" + Math.min(query.limit(), maxResults)
                    + "&searchTerm=" + VideoSourceText.urlEncode(title);
            JsonNode root = readJson(http.get(path, authHeaders()));
            for (JsonNode series : root.path("Items")) {
                VideoSourcePackage value = packageForSeries(series);
                packages.putIfAbsent(value.providerPackageId(), value);
            }
            if (packages.size() >= query.limit()) break;
        }
        return packages.values().stream().limit(query.limit()).toList();
    }

    @Override
    public VideoSourcePackage getPackage(String providerPackageId, String revision) {
        String path = "/Users/" + VideoSourceText.urlEncode(userId) + "/Items/"
                + VideoSourceText.urlEncode(providerPackageId)
                + "?fields=ProviderIds,ProductionYear,DateLastSaved";
        return packageForSeries(readJson(http.get(path, authHeaders())));
    }

    private VideoSourcePackage packageForSeries(JsonNode series) {
        String seriesId = required(series, "Id");
        String title = series.path("Name").asText(seriesId);
        List<VideoSourceItem> items = episodes(seriesId);
        String revisionSeed = series.path("DateLastSaved").asText("") + items.stream()
                .map(item -> item.providerItemId() + ":" + item.revision())
                .reduce("", String::concat);
        String revision = VideoSourceText.hash(revisionSeed);
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("jellyfinSeriesId", seriesId);
        if (series.hasNonNull("ProviderIds")) {
            snapshot.put("providerIds", objectMapper.convertValue(series.get("ProviderIds"), Map.class));
        }
        return new VideoSourcePackage(id(), seriesId, revision, title, "Jellyfin",
                series.hasNonNull("ProductionYear") ? series.get("ProductionYear").asInt() : null,
                null, "SERIES", items.size(), List.of(), List.of(), null, null, null,
                capabilities().capabilities(), sourcePage(seriesId), snapshot, items);
    }

    private List<VideoSourceItem> episodes(String seriesId) {
        String path = "/Shows/" + VideoSourceText.urlEncode(seriesId) + "/Episodes?userId="
                + VideoSourceText.urlEncode(userId)
                + "&fields=ProviderIds,DateLastSaved,RunTimeTicks&limit=10000";
        JsonNode root = readJson(http.get(path, authHeaders()));
        List<VideoSourceItem> items = new ArrayList<>();
        for (JsonNode episode : root.path("Items")) {
            String itemId = required(episode, "Id");
            Integer number = episode.hasNonNull("IndexNumber") ? episode.get("IndexNumber").asInt() : null;
            Long durationMs = episode.hasNonNull("RunTimeTicks")
                    ? episode.get("RunTimeTicks").asLong() / 10_000L : null;
            String itemRevision = VideoSourceText.hash(episode.path("DateLastSaved").asText("") + itemId);
            items.add(new VideoSourceItem(id(), seriesId, itemId, itemRevision,
                    VideoSourceStatus.ItemKind.EPISODE, number, null,
                    episode.path("Name").asText(number == null ? itemId : "Episode " + number),
                    durationMs, List.of(), List.of(), null,
                    Set.of(VideoSourceStatus.Capability.SOURCE_PAGE), sourcePage(itemId),
                    Map.of("jellyfinItemId", itemId)));
        }
        return items;
    }

    private Map<String, String> authHeaders() {
        return Map.of("X-Emby-Token", apiKey);
    }

    private JsonNode readJson(ProviderHttpClient.Response response) {
        try {
            return objectMapper.readTree(response.body());
        } catch (Exception e) {
            throw new VideoSourceProviderException(id(), "INVALID_RESPONSE",
                    "Jellyfin returned invalid JSON", false, e);
        }
    }

    private String required(JsonNode node, String field) {
        String value = node.path(field).asText();
        if (value.isBlank()) {
            throw new VideoSourceProviderException(id(), "INVALID_RESPONSE",
                    "Jellyfin response missed " + field, false);
        }
        return value;
    }

    private String sourcePage(String itemId) {
        return baseUrl + "/web/index.html#!/details?id=" + VideoSourceText.urlEncode(itemId);
    }

    @Override
    public VideoSourceResolution resolve(VideoSourceResolveRequest request) {
        throw new VideoSourceProviderException(id(), "LOGIN_REQUIRED",
                "Jellyfin playback relay is disabled to keep API keys out of URLs", false);
    }

    @Override
    public VideoSourceProbeResult probe(VideoSourceProbeRequest request) {
        throw new VideoSourceProviderException(id(), "PLAYBACK_UNSUPPORTED",
                "Jellyfin playback is not enabled", false);
    }

    @Override
    public VideoSourceDownloadPlan planDownload(VideoSourceDownloadRequest request) {
        throw new VideoSourceProviderException(id(), "DOWNLOAD_UNSUPPORTED",
                "Jellyfin download is not enabled", false);
    }
}
