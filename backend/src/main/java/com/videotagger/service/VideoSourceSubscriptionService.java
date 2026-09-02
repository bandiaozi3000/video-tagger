package com.videotagger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.VideoSourceDefinition;
import com.videotagger.entity.VideoSourceInstance;
import com.videotagger.entity.VideoSourceSubscription;
import com.videotagger.mapper.VideoSourceDefinitionMapper;
import com.videotagger.mapper.VideoSourceInstanceMapper;
import com.videotagger.mapper.VideoSourceSubscriptionMapper;
import com.videotagger.videosource.ConfiguredRssVideoSourceProvider;
import com.videotagger.videosource.AnimekoWebSelectorVideoSourceProvider;
import com.videotagger.videosource.RemoteResourcePolicy;
import com.videotagger.videosource.VideoSourceDiscoveryQuery;
import com.videotagger.videosource.VideoSourceProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class VideoSourceSubscriptionService {
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final int MAX_SOURCES = 200;
    private static final String[] SECRET_KEYS = {"apikey", "api_key", "token", "password", "authorization"};

    public record CreateRequest(String displayName, String url, Integer refreshIntervalMinutes) {}
    public record InstanceUpdate(Boolean enabled, Integer sortOrder) {}
    public record Preview(String url, int sourceCount, int compatibleCount, int partialCount,
                          int unsupportedCount, List<ImportedSource> sources) {}
    public record ImportedSource(String importKey, String factoryId, int version, String name,
                                 String description, String iconUrl, int tier, String compatibility,
                                 JsonNode arguments) {}
    public record SourceView(Long instanceId, Long definitionId, Long subscriptionId, String providerId,
                             String name, String description, String iconUrl, String factoryId, int version,
                             int tier, String compatibility, String definitionStatus, boolean enabled,
                             int sortOrder, String healthState, String healthMessage, Long lastTestedAt,
                             Map<String, Object> configuration) {}
    public record SubscriptionView(Long id, String displayName, String url, boolean enabled, int refreshIntervalMinutes,
                                   String status, Long lastAttemptAt, Long lastSuccessAt, int sourceCount,
                                   String errorMessage) {}
    public record ManagementView(List<SubscriptionView> subscriptions, List<SourceView> sources,
                                 List<Map<String, String>> templates) {}
    public record TestResult(long instanceId, String status, List<Map<String, Object>> steps) {}

    private final VideoSourceSubscriptionMapper subscriptionMapper;
    private final VideoSourceDefinitionMapper definitionMapper;
    private final VideoSourceInstanceMapper instanceMapper;
    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(10)).build();

    public VideoSourceSubscriptionService(VideoSourceSubscriptionMapper subscriptionMapper,
                                          VideoSourceDefinitionMapper definitionMapper,
                                          VideoSourceInstanceMapper instanceMapper,
                                          ObjectMapper objectMapper) {
        this.subscriptionMapper = subscriptionMapper;
        this.definitionMapper = definitionMapper;
        this.instanceMapper = instanceMapper;
        this.objectMapper = objectMapper;
    }

    public ManagementView management() {
        List<SourceView> sources = new ArrayList<>();
        for (VideoSourceInstance instance : instanceMapper.listAll()) {
            VideoSourceDefinition definition = definitionMapper.selectById(instance.getDefinitionId());
            if (definition == null) continue;
            sources.add(toView(instance, definition));
        }
        List<SubscriptionView> subscriptions = subscriptionMapper.listAll().stream().map(this::toView).toList();
        return new ManagementView(subscriptions, sources, List.of(
                Map.of("id", "rss", "name", "RSS", "description", "通用 RSS/BT 数据源"),
                Map.of("id", "web-selector", "name", "Web Selector", "description", "通用 CSS Selector 数据源"),
                Map.of("id", "jellyfin", "name", "Jellyfin", "description", "可选的个人媒体服务器"),
                Map.of("id", "animeko-bt", "name", "Animeko RSS/BT 订阅", "url", "https://sub.creamycake.org/v1/bt1.json"),
                Map.of("id", "animeko-css", "name", "Animeko Web 订阅", "url", "https://sub.creamycake.org/v1/css1.json")
        ));
    }

    public Preview preview(String url) {
        FetchResult fetched = fetch(url, null, null);
        return summarize(url, parse(fetched.body()));
    }

    @Transactional
    public ManagementView create(CreateRequest request) {
        String url = normalizeUrl(request.url());
        if (subscriptionMapper.selectByUrl(url) != null) throw new IllegalArgumentException("订阅地址已存在");
        long now = System.currentTimeMillis();
        VideoSourceSubscription value = new VideoSourceSubscription();
        value.setDisplayName(blank(request.displayName()) ? hostName(url) : request.displayName().trim());
        value.setUrl(url);
        value.setEnabled(1);
        value.setRefreshIntervalMinutes(clamp(request.refreshIntervalMinutes(), 15, 10080, 60));
        value.setStatus("PENDING");
        value.setSourceCount(0);
        value.setCreatedAt(now);
        value.setUpdatedAt(now);
        subscriptionMapper.insert(value);
        refresh(value.getId());
        return management();
    }

    @Transactional
    public ManagementView refresh(long subscriptionId) {
        VideoSourceSubscription subscription = requireSubscription(subscriptionId);
        long startedAt = System.currentTimeMillis();
        subscription.setLastAttemptAt(startedAt);
        subscription.setUpdatedAt(startedAt);
        try {
            FetchResult fetched;
            try {
                fetched = fetch(subscription.getUrl(), subscription.getEtag(), subscription.getLastModified());
            } catch (RuntimeException fetchError) {
                if (blank(subscription.getSnapshotJson())) throw fetchError;
                fetched = new FetchResult(false, subscription.getSnapshotJson(),
                        subscription.getEtag(), subscription.getLastModified());
            }
            if (fetched.notModified()) {
                if (!blank(subscription.getSnapshotJson())) {
                    fetched = new FetchResult(false, subscription.getSnapshotJson(),
                            subscription.getEtag(), subscription.getLastModified());
                } else {
                    fetched = fetch(subscription.getUrl(), null, null);
                }
            }
            List<ImportedSource> imported = parse(fetched.body());
            for (ImportedSource source : imported) upsert(subscriptionId, source, startedAt);
            definitionMapper.markMissing(subscriptionId, startedAt, System.currentTimeMillis());
            subscription.setStatus("READY");
            subscription.setEtag(fetched.etag());
            subscription.setLastModified(fetched.lastModified());
            subscription.setLastSuccessAt(System.currentTimeMillis());
            subscription.setSourceCount(imported.size());
            subscription.setErrorMessage(null);
            subscription.setSnapshotJson(fetched.body());
        } catch (RuntimeException e) {
            subscription.setStatus("FAILED");
            subscription.setErrorMessage(safeMessage(e));
        }
        subscription.setUpdatedAt(System.currentTimeMillis());
        subscriptionMapper.updateById(subscription);
        return management();
    }

    public ManagementView updateInstance(long instanceId, InstanceUpdate request) {
        VideoSourceInstance instance = requireInstance(instanceId);
        if (request.enabled() != null) instance.setEnabled(request.enabled() ? 1 : 0);
        if (request.sortOrder() != null) instance.setSortOrder(Math.max(0, request.sortOrder()));
        instance.setUpdatedAt(System.currentTimeMillis());
        instanceMapper.updateById(instance);
        return management();
    }

    public ManagementView disableSubscription(long subscriptionId) {
        VideoSourceSubscription subscription = requireSubscription(subscriptionId);
        subscription.setEnabled(0);
        subscription.setStatus("DISABLED");
        subscription.setUpdatedAt(System.currentTimeMillis());
        subscriptionMapper.updateById(subscription);
        return management();
    }

    public TestResult test(long instanceId, String keyword) {
        VideoSourceInstance instance = requireInstance(instanceId);
        VideoSourceDefinition definition = definitionMapper.selectById(instance.getDefinitionId());
        List<Map<String, Object>> steps = new ArrayList<>();
        long now = System.currentTimeMillis();
        try {
            if (!"SUPPORTED".equals(definition.getCompatibility())) {
                steps.add(Map.of("name", "配置兼容", "status", "LIMITED", "message", definition.getCompatibility()));
                steps.add(Map.of("name", "搜索作品", "status", "SKIPPED", "message", "已导入定义，但当前解析引擎尚不能执行该格式"));
                steps.add(Map.of("name", "播放能力", "status", "LIMITED", "message", "需要补齐 HLS、嵌套页面或媒体请求捕获能力"));
                markHealth(instance, "LIMITED", "配置已导入，当前仅支持兼容性检查", true, now);
                return new TestResult(instanceId, "LIMITED", steps);
            }
            VideoSourceProvider provider = providerFor(instance, definition);
            steps.add(Map.of("name", "配置兼容", "status", "PASS", "message", definition.getCompatibility()));
            var packages = provider.discover(new VideoSourceDiscoveryQuery(0, Map.of(),
                    List.of(blank(keyword) ? "动画" : keyword.trim()), null, null, "VIDEO", null, 0, 10));
            steps.add(Map.of("name", "搜索作品", "status", "PASS", "message", "找到 " + packages.size() + " 个候选"));
            int items = packages.stream().mapToInt(value -> value.items().size()).sum();
            steps.add(Map.of("name", "解析剧集", "status", "PASS", "message", "解析 " + items + " 个源项"));
            var playableItem = packages.stream().flatMap(value -> value.items().stream()
                            .map(item -> Map.entry(value, item)))
                    .filter(value -> value.getValue().capabilities().contains(
                            com.videotagger.videosource.VideoSourceStatus.Capability.RESOLVE_PLAYBACK))
                    .findFirst();
            boolean direct = false;
            String playbackMessage = items > 0 ? "未解析到直放地址，可在 Episode 中打开源站播放" : "没有可用播放候选";
            if (playableItem.isPresent()) {
                try {
                    var sourcePackage = playableItem.get().getKey();
                    var item = playableItem.get().getValue();
                    var resolution = provider.resolve(new com.videotagger.videosource.VideoSourceResolveRequest(
                            sourcePackage.providerPackageId(), item.providerItemId(), item.revision(),
                            com.videotagger.videosource.VideoSourceStatus.ResolutionPurpose.PLAYBACK,
                            null, null, null));
                    var probe = provider.probe(new com.videotagger.videosource.VideoSourceProbeRequest(
                            sourcePackage.providerPackageId(), item.providerItemId(), item.revision(), resolution));
                    direct = probe.state() == com.videotagger.videosource.VideoSourceStatus.ProbeState.PLAYABLE;
                    playbackMessage = direct ? "直放地址解析与探测通过" : "直放探测未通过，可在 Episode 中打开源站播放";
                } catch (RuntimeException e) {
                    playbackMessage = "直放未通过，可在 Episode 中打开源站播放：" + safeMessage(e);
                }
            }
            steps.add(Map.of("name", "播放出口", "status", direct ? "PASS" : items > 0 ? "LIMITED" : "FAIL",
                    "message", playbackMessage));
            boolean available = items > 0;
            markHealth(instance, available ? "HEALTHY" : "FAILED",
                    direct ? "直放测试通过" : available ? "源站播放可用" : "未找到播放候选", available, now);
            return new TestResult(instanceId, direct ? "PASS" : available ? "LIMITED" : "FAIL", steps);
        } catch (RuntimeException e) {
            steps.add(Map.of("name", "测试失败", "status", "FAIL", "message", safeMessage(e)));
            markHealth(instance, "FAILED", safeMessage(e), false, now);
            return new TestResult(instanceId, "FAIL", steps);
        }
    }

    public List<ProviderBinding> enabledProviders() {
        List<ProviderBinding> values = new ArrayList<>();
        for (VideoSourceInstance instance : instanceMapper.listEnabled()) {
            VideoSourceDefinition definition = definitionMapper.selectById(instance.getDefinitionId());
            if (definition == null || !"ACTIVE".equals(definition.getStatus())) continue;
            try {
                values.add(new ProviderBinding(instance, definition, providerFor(instance, definition)));
            } catch (RuntimeException ignored) {
            }
        }
        return values;
    }

    public record ProviderBinding(VideoSourceInstance instance, VideoSourceDefinition definition, VideoSourceProvider provider) {}

    @Scheduled(fixedDelay = 60_000)
    public void refreshDue() {
        for (VideoSourceSubscription subscription : subscriptionMapper.listDue(System.currentTimeMillis())) {
            refresh(subscription.getId());
        }
    }

    private VideoSourceProvider providerFor(VideoSourceInstance instance, VideoSourceDefinition definition) {
        try {
            JsonNode arguments = objectMapper.readTree(definition.getConfigJson());
            if ("rss".equals(definition.getFactoryId()) && definition.getFormatVersion() == 1) {
                String searchUrl = arguments.path("searchConfig").path("searchUrl").asText();
                URI uri = URI.create(searchUrl.replace("{keyword}", "test"));
                String baseUrl = uri.getScheme() + "://" + uri.getAuthority();
                return new ConfiguredRssVideoSourceProvider(instance.getProviderId(), definition.getName(),
                        baseUrl, searchUrl, 10_000, 100);
            }
            if ("web-selector".equals(definition.getFactoryId()) && definition.getFormatVersion() == 2) {
                return new AnimekoWebSelectorVideoSourceProvider(instance.getProviderId(), definition.getName(),
                        arguments, 10_000, 30);
            }
            throw new IllegalStateException("当前数据源格式不可执行");
        } catch (Exception e) {
            throw new IllegalArgumentException("数据源配置无效", e);
        }
    }

    private void upsert(long subscriptionId, ImportedSource source, long seenAt) {
        long now = System.currentTimeMillis();
        VideoSourceDefinition definition = definitionMapper.selectImported(subscriptionId, source.importKey());
        boolean created = definition == null;
        if (created) {
            definition = new VideoSourceDefinition();
            definition.setSubscriptionId(subscriptionId);
            definition.setImportKey(source.importKey());
            definition.setCreatedAt(now);
        }
        definition.setFactoryId(source.factoryId());
        definition.setFormatVersion(source.version());
        definition.setName(source.name());
        definition.setDescription(source.description());
        definition.setIconUrl(source.iconUrl());
        definition.setConfigJson(source.arguments().toString());
        definition.setTier(source.tier());
        definition.setCompatibility(source.compatibility());
        definition.setStatus("ACTIVE");
        definition.setLastSeenAt(seenAt);
        definition.setUpdatedAt(now);
        if (created) definitionMapper.insert(definition); else definitionMapper.updateById(definition);
        VideoSourceInstance instance = instanceMapper.selectByDefinition(definition.getId());
        if (instance == null) {
            instance = new VideoSourceInstance();
            instance.setDefinitionId(definition.getId());
            instance.setProviderId("sub-" + subscriptionId + "-" + source.importKey().substring(0, 16));
            instance.setEnabled(0);
            instance.setSortOrder(1000 + source.tier() * 100);
            instance.setHealthState("UNTESTED");
            instance.setFailureCount(0);
            instance.setCreatedAt(now);
            instance.setUpdatedAt(now);
            instanceMapper.insert(instance);
        }
    }

    List<ImportedSource> parse(String body) {
        try {
            JsonNode sources = objectMapper.readTree(body).path("exportedMediaSourceDataList").path("mediaSources");
            if (!sources.isArray()) throw new IllegalArgumentException("不是受支持的 Animeko 数据源订阅");
            if (sources.size() > MAX_SOURCES) throw new IllegalArgumentException("订阅包含过多数据源");
            List<ImportedSource> values = new ArrayList<>();
            for (JsonNode node : sources) {
                String factoryId = node.path("factoryId").asText("").trim();
                int version = node.path("version").asInt(0);
                JsonNode arguments = node.path("arguments");
                String name = arguments.path("name").asText("").trim();
                if (factoryId.isBlank() || name.isBlank() || !arguments.isObject()) continue;
                boolean unsafe = containsSecret(arguments);
                JsonNode sanitizedArguments = unsafe ? objectMapper.createObjectNode() : sanitizeArguments(arguments);
                String compatibility = compatibility(factoryId, version, sanitizedArguments, unsafe);
                int tier = Math.max(0, Math.min(arguments.path("tier").asInt(2), 9));
                String origin = searchOrigin(arguments.path("searchConfig").path("searchUrl").asText(""));
                String importKey = hash(factoryId + "\n" + name.toLowerCase(Locale.ROOT) + "\n" + origin);
                values.add(new ImportedSource(importKey, factoryId, version, name,
                        arguments.path("description").asText(""), arguments.path("iconUrl").asText(""),
                        tier, compatibility, sanitizedArguments));
            }
            return values;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("订阅 JSON 解析失败", e);
        }
    }

    private FetchResult fetch(String rawUrl, String etag, String lastModified) {
        try {
            String normalized = normalizeUrl(rawUrl);
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(normalized)).GET()
                    .timeout(Duration.ofSeconds(20)).header("Accept", "application/json")
                    .header("User-Agent", "VideoTagger/0.23");
            if (!blank(etag)) builder.header("If-None-Match", etag);
            if (!blank(lastModified)) builder.header("If-Modified-Since", lastModified);
            HttpResponse<byte[]> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() == 304) return new FetchResult(true, null, etag, lastModified);
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("订阅请求失败：HTTP " + response.statusCode());
            }
            if (response.body().length > MAX_BYTES) throw new IllegalArgumentException("订阅响应超过 2MB 限制");
            String contentType = response.headers().firstValue("Content-Type").orElse("");
            if (!contentType.toLowerCase(Locale.ROOT).contains("json")) throw new IllegalArgumentException("订阅响应不是 JSON");
            return new FetchResult(false, new String(response.body(), StandardCharsets.UTF_8),
                    response.headers().firstValue("ETag").orElse(null),
                    response.headers().firstValue("Last-Modified").orElse(null));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("订阅请求被中断", e);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("订阅网络请求失败", e);
        }
    }

    private Preview summarize(String url, List<ImportedSource> sources) {
        int compatible = (int) sources.stream().filter(value -> "SUPPORTED".equals(value.compatibility())).count();
        int partial = (int) sources.stream().filter(value -> "PARTIAL".equals(value.compatibility())).count();
        return new Preview(url, sources.size(), compatible, partial, sources.size() - compatible - partial, sources);
    }

    private static String compatibility(String factoryId, int version, JsonNode arguments, boolean unsafe) {
        if (unsafe) return "UNSAFE";
        if ("rss".equals(factoryId) && version == 1
                && arguments.path("searchConfig").path("searchUrl").asText("").contains("{keyword}")) return "SUPPORTED";
        if ("web-selector".equals(factoryId) && version == 2
                && arguments.path("searchConfig").path("searchUrl").asText("").contains("{keyword}")) {
            JsonNode search = arguments.path("searchConfig");
            boolean subject = !search.path("selectorSubjectFormatA").path("selectLists").asText("").isBlank()
                    || (!search.path("selectorSubjectFormatIndexed").path("selectNames").asText("").isBlank()
                    && !search.path("selectorSubjectFormatIndexed").path("selectLinks").asText("").isBlank());
            boolean episodes = !search.path("selectorChannelFormatNoChannel").path("selectEpisodes").asText("").isBlank()
                    || (!search.path("selectorChannelFormatFlattened").path("selectEpisodeLists").asText("").isBlank()
                    && !search.path("selectorChannelFormatFlattened").path("selectEpisodesFromList").asText("").isBlank());
            if (subject && episodes) return "SUPPORTED";
        }
        return "UNSUPPORTED";
    }

    private JsonNode sanitizeArguments(JsonNode arguments) {
        JsonNode copy = arguments.deepCopy();
        removeNonExecutableRequestOptions(copy);
        return copy;
    }

    private static void removeNonExecutableRequestOptions(JsonNode node) {
        if (node.isObject()) {
            ((com.fasterxml.jackson.databind.node.ObjectNode) node).remove(List.of("cookies", "addHeadersToVideo"));
            var fields = node.fields();
            while (fields.hasNext()) removeNonExecutableRequestOptions(fields.next().getValue());
        } else if (node.isArray()) {
            for (JsonNode child : node) removeNonExecutableRequestOptions(child);
        }
    }

    private static boolean containsSecret(JsonNode node) {
        if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                var field = fields.next();
                String key = field.getKey().toLowerCase(Locale.ROOT);
                for (String secret : SECRET_KEYS) if (key.contains(secret)) return true;
                if (containsSecret(field.getValue())) return true;
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) if (containsSecret(child)) return true;
        }
        return false;
    }

    private String normalizeUrl(String raw) {
        if (blank(raw)) throw new IllegalArgumentException("订阅地址不能为空");
        URI uri = RemoteResourcePolicy.validateLocator(raw.trim(), false);
        if (!"https".equalsIgnoreCase(uri.getScheme())) throw new IllegalArgumentException("订阅地址必须使用 HTTPS");
        if (uri.getUserInfo() != null) throw new IllegalArgumentException("订阅地址不能包含凭据");
        return uri.normalize().toString();
    }

    private SourceView toView(VideoSourceInstance instance, VideoSourceDefinition definition) {
        return new SourceView(instance.getId(), definition.getId(), definition.getSubscriptionId(),
                instance.getProviderId(), definition.getName(), definition.getDescription(), definition.getIconUrl(),
                definition.getFactoryId(), definition.getFormatVersion(), definition.getTier(),
                definition.getCompatibility(), definition.getStatus(), instance.getEnabled() != null && instance.getEnabled() == 1,
                instance.getSortOrder(), instance.getHealthState(), instance.getHealthMessage(), instance.getLastTestedAt(),
                configuration(definition));
    }

    private Map<String, Object> configuration(VideoSourceDefinition definition) {
        try {
            JsonNode arguments = objectMapper.readTree(definition.getConfigJson());
            JsonNode search = arguments.path("searchConfig");
            return Map.of(
                    "searchUrl", search.path("searchUrl").asText(""),
                    "subjectFormat", search.path("subjectFormatId").asText(""),
                    "channelFormat", search.path("channelFormatId").asText(""),
                    "defaultResolution", search.path("defaultResolution").asText(""),
                    "directPlayback", !search.path("matchVideo").path("matchVideoUrl").asText("").isBlank());
        } catch (Exception e) {
            return Map.of();
        }
    }

    private SubscriptionView toView(VideoSourceSubscription value) {
        return new SubscriptionView(value.getId(), value.getDisplayName(), value.getUrl(),
                value.getEnabled() != null && value.getEnabled() == 1,
                value.getRefreshIntervalMinutes() == null ? 60 : value.getRefreshIntervalMinutes(),
                value.getStatus(), value.getLastAttemptAt(), value.getLastSuccessAt(),
                value.getSourceCount() == null ? 0 : value.getSourceCount(), value.getErrorMessage());
    }

    private void markHealth(VideoSourceInstance instance, String state, String message, boolean success, long now) {
        instance.setHealthState(state);
        instance.setHealthMessage(message);
        instance.setLastTestedAt(now);
        if (success) {
            instance.setLastSuccessAt(now);
            instance.setFailureCount(0);
        } else {
            instance.setFailureCount((instance.getFailureCount() == null ? 0 : instance.getFailureCount()) + 1);
        }
        instance.setUpdatedAt(now);
        instanceMapper.updateById(instance);
    }

    private VideoSourceSubscription requireSubscription(long id) {
        VideoSourceSubscription value = subscriptionMapper.selectById(id);
        if (value == null) throw new IllegalArgumentException("数据源订阅不存在");
        return value;
    }

    private VideoSourceInstance requireInstance(long id) {
        VideoSourceInstance value = instanceMapper.selectById(id);
        if (value == null) throw new IllegalArgumentException("数据源实例不存在");
        return value;
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String searchOrigin(String raw) {
        try {
            URI uri = URI.create(raw.replace("{keyword}", "test"));
            return uri.getScheme() + "://" + uri.getAuthority();
        } catch (Exception e) {
            return raw;
        }
    }

    private static String hostName(String url) {
        return URI.create(url).getHost();
    }

    private static int clamp(Integer value, int min, int max, int fallback) {
        return value == null ? fallback : Math.max(min, Math.min(max, value));
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String safeMessage(Throwable error) {
        String message = error.getMessage();
        return blank(message) ? error.getClass().getSimpleName() : message.replaceAll("(?i)(api[_-]?key|token|password)=[^&\\s]+", "$1=<redacted>");
    }

    private record FetchResult(boolean notModified, String body, String etag, String lastModified) {}
}
