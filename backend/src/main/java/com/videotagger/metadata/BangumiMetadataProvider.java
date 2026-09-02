package com.videotagger.metadata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Bangumi v0 HTTP adapter. It only fetches metadata; it never handles video resources. */
@Service
public class BangumiMetadataProvider implements MetadataProvider {
    public static final String ID = "BANGUMI";
    private static final String DEFAULT_BASE_URL = "https://api.bgm.tv";
    private static final int MAX_LIMIT = 100;
    private static final int MAX_RESULTS = 1000;
    private static final int MAX_SEARCH_PAGES = 100;
    private static final int MAX_ATTEMPTS = 3;
    private static final long REQUEST_DELAY_MS = 150;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String baseUrl;
    private final String accessToken;

    @org.springframework.beans.factory.annotation.Autowired
    public BangumiMetadataProvider(ObjectMapper objectMapper,
                                   @Value("${videotagger.metadata.bangumi.base-url:https://api.bgm.tv}") String baseUrl,
                                   @Value("${videotagger.metadata.bangumi.access-token:}") String accessToken) {
        this.objectMapper = objectMapper;
        this.baseUrl = trimTrailingSlash(baseUrl);
        this.accessToken = accessToken == null ? "" : accessToken.trim();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    BangumiMetadataProvider(ObjectMapper objectMapper, String baseUrl) {
        this.objectMapper = objectMapper;
        this.baseUrl = trimTrailingSlash(baseUrl);
        this.accessToken = "";
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public ProviderCapabilities capabilities() {
        return new ProviderCapabilities(ID, "Bangumi", true, true, true, true);
    }

    @Override
    public List<MetadataRecord> search(String keyword, int limit) throws MetadataProviderException {
        String q = keyword == null ? "" : keyword.trim();
        if (q.isEmpty()) return List.of();
        Map<String, Object> filter = new LinkedHashMap<>();
        filter.put("type", List.of(2));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("keyword", q);
        body.put("sort", "match");
        body.put("filter", filter);
        return fetchSearchPages(body, boundedResults(limit));
    }

    @Override
    public List<MetadataRecord> discover(Integer year, String season, int limit) throws MetadataProviderException {
        if (year == null || year < 1900 || year > 2200) {
            throw new MetadataProviderException("年份无效", 422);
        }
        List<String> dates = dateRange(year, season);
        Map<String, Object> filter = new LinkedHashMap<>();
        filter.put("type", List.of(2));
        filter.put("air_date", dates);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("keyword", "");
        body.put("filter", filter);
        return fetchSearchPages(body, Math.min(Math.max(limit, 1), MAX_RESULTS));
    }

    @Override
    public MetadataRecord get(String externalId) throws MetadataProviderException {
        if (externalId == null || !externalId.matches("[0-9]+")) {
            throw new MetadataProviderException("Bangumi 条目 ID 无效", 422);
        }
        JsonNode subject = getJson("/v0/subjects/" + externalId);
        List<MetadataEpisodeRecord> episodes = fetchEpisodes(externalId);
        List<MetadataRelationRecord> relations = fetchRelations(externalId);
        return parseSubject(subject, episodes, relations, subject.toString());
    }

    private List<MetadataRecord> fetchSearchPages(Map<String, Object> baseBody, int requestedLimit) {
        Map<String, MetadataRecord> unique = new LinkedHashMap<>();
        Set<String> pageFingerprints = new LinkedHashSet<>();
        int offset = 0;
        int pageSize = Math.min(requestedLimit, MAX_LIMIT);
        int pages = 0;
        while (unique.size() < requestedLimit && pages++ < MAX_SEARCH_PAGES) {
            Map<String, Object> body = new LinkedHashMap<>(baseBody);
            SearchPage page = parseSearchPage(post("/v0/search/subjects?limit=" + pageSize + "&offset=" + offset, body));
            if (page.records().isEmpty()) break;
            String fingerprint = page.records().stream().map(MetadataRecord::externalId)
                    .reduce((left, right) -> left + "," + right).orElse("");
            if (!pageFingerprints.add(fingerprint)) break;
            for (MetadataRecord record : page.records()) {
                unique.putIfAbsent(record.provider() + ":" + record.externalId(), record);
            }
            int nextOffset = offset + page.records().size();
            if (nextOffset <= offset || (page.total() > 0 && nextOffset >= page.total())) break;
            offset = nextOffset;
        }
        List<MetadataRecord> result = new ArrayList<>(unique.values());
        return result.size() > requestedLimit ? result.subList(0, requestedLimit) : result;
    }

    private SearchPage parseSearchPage(JsonNode root) {
        JsonNode data = root.path("data");
        if (!data.isArray()) {
            throw new MetadataProviderException("Bangumi 搜索响应缺少 data", 502);
        }
        List<MetadataRecord> result = new ArrayList<>();
        for (JsonNode node : data) {
            String id = text(node, "id");
            String title = firstNonBlank(text(node, "name_cn"), text(node, "name"));
            if (id == null || title == null) continue;
            result.add(parseSubject(node, List.of(), List.of(), node.toString()));
        }
        Integer total = intValue(root, "total");
        return new SearchPage(result, total == null ? 0 : total);
    }

    private record SearchPage(List<MetadataRecord> records, int total) { }

    private MetadataRecord parseSubject(JsonNode node, List<MetadataEpisodeRecord> episodes,
                                        List<MetadataRelationRecord> relations, String rawJson) {
        String name = text(node, "name");
        String nameCn = text(node, "name_cn");
        String canonical = firstNonBlank(nameCn, name);
        List<String> aliases = new ArrayList<>();
        if (name != null && !name.equals(canonical)) aliases.add(name);
        JsonNode infobox = node.path("infobox");
        Map<String, String> infoboxValues = new LinkedHashMap<>();
        if (infobox.isArray()) {
            for (JsonNode item : infobox) {
                String key = text(item, "key");
                String value = infoboxValue(item);
                if (key != null && value != null) infoboxValues.put(key, value);
                if ("别名".equals(key)) {
                    JsonNode values = item.path("value");
                    if (values.isArray()) {
                        for (JsonNode aliasValue : values) {
                            String alias = aliasValue.isTextual() ? aliasValue.asText() : text(aliasValue, "v");
                            if (alias != null && !alias.isBlank() && !aliases.contains(alias)) aliases.add(alias);
                        }
                    }
                }
            }
        }
        List<String> genres = new ArrayList<>();
        JsonNode tags = node.path("tags");
        if (tags.isArray()) {
            for (JsonNode tag : tags) {
                String tagName = text(tag, "name");
                if (tagName != null && !tagName.isBlank()) genres.add(tagName);
            }
        }
        JsonNode images = node.path("images");
        String cover = firstNonBlank(text(images, "large"), text(images, "common"), text(images, "medium"));
        String date = text(node, "date");
        Integer year = parseYear(date);
        return new MetadataRecord(
                ID,
                text(node, "id"),
                canonical,
                name,
                firstNonBlank(infoboxValues.get("罗马字"), infoboxValues.get("罗马音")),
                firstNonBlank(infoboxValues.get("英文名"), infoboxValues.get("英文"), infoboxValues.get("English")),
                aliases,
                text(node, "summary"),
                cover,
                genres,
                text(node, "platform"),
                year,
                seasonFromDate(date),
                date,
                firstNonBlank(infoboxValues.get("放送结束"), infoboxValues.get("结束"), infoboxValues.get("完结")),
                intValue(node, "eps"),
                episodes,
                relations,
                rawJson
        );
    }

    private List<MetadataRelationRecord> fetchRelations(String externalId) {
        try {
            JsonNode root = getJson("/v0/subjects/" + externalId + "/subjects");
            JsonNode data = root.isArray() ? root : root.path("data");
            if (!data.isArray()) return List.of();
            List<MetadataRelationRecord> result = new ArrayList<>();
            for (JsonNode node : data) {
                String id = text(node, "id");
                String title = firstNonBlank(text(node, "name_cn"), text(node, "name"));
                String relation = firstNonBlank(text(node, "relation"), text(node, "relation_type"));
                if (id != null && title != null) result.add(new MetadataRelationRecord(id, relation, title));
            }
            return result;
        } catch (RuntimeException ignored) {
            return List.of();
        }
    }

    private static String infoboxValue(JsonNode item) {
        JsonNode value = item.path("value");
        if (value.isArray()) {
            List<String> values = new ArrayList<>();
            for (JsonNode entry : value) {
                String text = entry.isTextual() ? entry.asText() : firstNonBlank(text(entry, "v"), text(entry, "value"));
                if (text != null && !text.isBlank()) values.add(text.trim());
            }
            return values.isEmpty() ? null : String.join(" / ", values);
        }
        return value.isTextual() ? value.asText().trim() : null;
    }

    private List<MetadataEpisodeRecord> fetchEpisodes(String externalId) {
        List<MetadataEpisodeRecord> result = new ArrayList<>();
        int offset = 0;
        while (true) {
            JsonNode page = getJson("/v0/episodes?subject_id=" + externalId + "&limit=" + MAX_LIMIT + "&offset=" + offset);
            JsonNode items = page.isArray() ? page : page.path("data");
            if (!items.isArray() || items.isEmpty()) break;
            for (JsonNode node : items) {
                String id = text(node, "id");
                if (id == null) continue;
                result.add(new MetadataEpisodeRecord(
                        id,
                        numberValue(node.path("sort")),
                        firstNonBlank(text(node, "name_cn"), text(node, "name")),
                        text(node, "name_cn"),
                        text(node, "desc"),
                        text(node, "airdate"),
                        intValue(node, "duration")
                ));
            }
            if (items.size() < MAX_LIMIT) break;
            offset += MAX_LIMIT;
        }
        return result;
    }

    private JsonNode getJson(String path) {
        return request("GET", path, null);
    }

    private JsonNode post(String path, Map<String, Object> body) {
        try {
            return request("POST", path, objectMapper.writeValueAsString(body));
        } catch (IOException e) {
            throw new MetadataProviderException("序列化 Bangumi 请求失败", e);
        }
    }

    private JsonNode request(String method, String path, String body) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                if (attempt > 1 || REQUEST_DELAY_MS > 0) Thread.sleep(REQUEST_DELAY_MS * attempt);
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path))
                    .timeout(Duration.ofSeconds(30))
                    .header("Accept", "application/json")
                    .header("User-Agent", "video-tagger/0.22");
            if (!accessToken.isBlank()) builder.header("Authorization", "Bearer " + accessToken);
            if ("POST".equals(method)) {
                builder.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body == null ? "{}" : body));
            } else {
                builder.GET();
            }
            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status == 404) throw new MetadataProviderException("Bangumi 条目不存在", 404);
            if (status == 429 || status >= 500) {
                if (attempt < MAX_ATTEMPTS) continue;
                throw new MetadataProviderException("Bangumi 服务暂不可用（HTTP " + status + "）", 502);
            }
            if (status < 200 || status >= 300) {
                int clientStatus = status >= 400 && status < 500 ? status : 502;
                throw new MetadataProviderException("Bangumi 请求失败（HTTP " + status + "）", clientStatus);
            }
            JsonNode root = objectMapper.readTree(response.body());
            if (root == null || root.isMissingNode()) throw new MetadataProviderException("Bangumi 返回空响应", 502);
            return root;
            } catch (MetadataProviderException e) {
                throw e;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new MetadataProviderException("Bangumi 请求被中断", e);
            } catch (Exception e) {
                if (attempt < MAX_ATTEMPTS) continue;
                throw new MetadataProviderException("Bangumi 请求失败", e);
            }
        }
        throw new MetadataProviderException("Bangumi 请求失败", 502);
    }

    private static List<String> dateRange(int year, String season) {
        String normalized = season == null ? "" : season.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "WINTER" -> List.of(">=" + year + "-01-01", "<" + year + "-04-01");
            case "SPRING" -> List.of(">=" + year + "-04-01", "<" + year + "-07-01");
            case "SUMMER" -> List.of(">=" + year + "-07-01", "<" + year + "-10-01");
            case "FALL", "AUTUMN" -> List.of(">=" + year + "-10-01", "<" + (year + 1) + "-01-01");
            case "" -> List.of(">=" + year + "-01-01", "<" + (year + 1) + "-01-01");
            default -> throw new MetadataProviderException("季度无效", 422);
        };
    }

    private static Integer parseYear(String date) {
        if (date == null || date.length() < 4) return null;
        try { return Integer.valueOf(date.substring(0, 4)); }
        catch (NumberFormatException ignored) { return null; }
    }

    private static String seasonFromDate(String date) {
        if (date == null || date.length() < 7) return null;
        int month;
        try { month = Integer.parseInt(date.substring(5, 7)); }
        catch (NumberFormatException e) { return null; }
        return month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
    }

    private static Integer numberValue(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        if (node.isNumber()) return node.intValue();
        try { return Integer.valueOf(node.asText().replaceAll("[^0-9].*", "")); }
        catch (NumberFormatException ignored) { return null; }
    }

    private static Integer intValue(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.intValue() : null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.path(field);
        if (value == null || value.isMissingNode() || value.isNull()) return null;
        String text = value.asText().trim();
        return text.isEmpty() ? null : text;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value;
        return null;
    }

    private static int boundedResults(int limit) {
        return Math.min(Math.max(limit, 1), MAX_RESULTS);
    }

    private static String trimTrailingSlash(String value) {
        String result = value == null || value.isBlank() ? DEFAULT_BASE_URL : value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }
}
