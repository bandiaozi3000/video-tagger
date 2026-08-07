package com.videotagger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Media;
import com.videotagger.mapper.MediaMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * AniList 番剧同步：按年份拉取（名称/年份/封面）建媒体档案，命中库中已有（title 或 original_title）跳过。
 *
 * 数据源：graphql.anilist.co（免认证），按 seasonYear 循环分页，每页 50 条，hasNextPage 控制翻页。
 * 只同步名称 / 首播年份 / 封面三项；标题以 AniList 日文原名（title.native）入库，用户可后续编辑成中文。
 * 封面下载走 CoverService.downloadAsync（复用 coverExecutor，失败静默降级无封面），不阻塞同步主链路。
 * 限流：AniList 对公开查询较宽松，仍保留每页 ~200ms 间隔避免大批量被 429。
 */
@Service
public class AniListSyncService {

    private static final Logger log = LoggerFactory.getLogger(AniListSyncService.class);
    private static final String DEFAULT_API = "https://graphql.anilist.co";
    private static final String UA = "video-tagger-sync/0.14";
    private static final int PER_PAGE = 50;
    private static final long PAGE_DELAY_MS = 200;
    private static final int MIN_YEAR = 2000;
    private static final int MAX_YEAR = 2026;

    /** 同步结果：新增 / 跳过（命中库中已有）。 */
    public record SyncResult(int added, int skipped) {
    }

    private final MediaMapper mediaMapper;
    private final CoverService coverService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiBase;

    @Autowired
    public AniListSyncService(MediaMapper mediaMapper, CoverService coverService, ObjectMapper objectMapper) {
        this(mediaMapper, coverService, objectMapper, DEFAULT_API);
    }

    /** 包可见构造：测试可注入 MockWebServer 地址。 */
    AniListSyncService(MediaMapper mediaMapper, CoverService coverService, ObjectMapper objectMapper, String apiBase) {
        this.mediaMapper = mediaMapper;
        this.coverService = coverService;
        this.objectMapper = objectMapper;
        this.apiBase = apiBase;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    /** 按年份逐个拉取同步；单个年份失败跳过（记日志），不影响其余年份。 */
    public SyncResult sync(List<Integer> years) {
        int added = 0;
        int skipped = 0;
        for (Integer year : years) {
            if (year == null || year < MIN_YEAR || year > MAX_YEAR) {
                log.warn("跳过非法年份: {}", year);
                continue;
            }
            try {
                SyncResult r = syncYear(year);
                added += r.added();
                skipped += r.skipped();
            } catch (Exception e) {
                log.warn("同步 {} 年失败（跳过该年）: {}", year, e.getMessage());
            }
        }
        return new SyncResult(added, skipped);
    }

    /** 同步单个年份：循环分页拉取并逐条入库。 */
    private SyncResult syncYear(int year) throws IOException, InterruptedException {
        int added = 0;
        int skipped = 0;
        int page = 1;
        boolean hasNext;
        do {
            JsonNode root = fetchPage(year, page);
            JsonNode media = root.path("data").path("Page").path("media");
            hasNext = root.path("data").path("Page").path("pageInfo").path("hasNextPage").asBoolean();
            for (JsonNode m : media) {
                SyncResult r = upsert(m, year);
                added += r.added();
                skipped += r.skipped();
            }
            page++;
            if (hasNext) {
                Thread.sleep(PAGE_DELAY_MS);
            }
        } while (hasNext);
        log.info("AniList 同步 {} 年完成：新增 {}，跳过 {}", year, added, skipped);
        return new SyncResult(added, skipped);
    }

    /** 拉取一页 GraphQL 结果，解析为 JSON 树。 */
    private JsonNode fetchPage(int year, int page) throws IOException, InterruptedException {
        String query = """
                query ($year: Int, $page: Int, $perPage: Int) {
                  Page(page: $page, perPage: $perPage) {
                    pageInfo { hasNextPage }
                    media(seasonYear: $year, type: ANIME, isAdult: false, sort: START_DATE) {
                      id
                      title { native }
                      startDate { year }
                      coverImage { large }
                      format
                    }
                  }
                }
                """;
        String body = "{\"query\":" + objectMapper.writeValueAsString(query)
                + ",\"variables\":{\"year\":" + year + ",\"page\":" + page + ",\"perPage\":" + PER_PAGE + "}}";
        HttpRequest req = HttpRequest.newBuilder(URI.create(apiBase))
                .header("User-Agent", UA)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new IllegalStateException("AniList HTTP " + resp.statusCode());
        }
        return objectMapper.readTree(resp.body());
    }

    /** 单条番剧入库：严格按首播年份过滤后，title/original_title 任一命中库中已有 → 跳过；否则建媒体 + 异步封面。 */
    private SyncResult upsert(JsonNode m, int targetYear) {
        String nativeTitle = m.path("title").path("native").asText("").trim();
        if (nativeTitle.isEmpty()) {
            return new SyncResult(0, 0); // 无标题的脏数据直接忽略，不计跳过
        }
        // seasonYear 查询会混入未标季度的老番（实测勾 2000 竟混入 1969~1999 各年份），必须严格按 startDate.year 过滤
        int actualYear = m.path("startDate").path("year").asInt(0);
        if (actualYear != targetYear) {
            return new SyncResult(0, 0);
        }
        String cover = m.path("coverImage").path("large").asText(null);
        Media existing = mediaMapper.selectByTitleOrOriginal(nativeTitle);
        if (existing != null) {
            // 命中已有：若尚无封面且本次带 URL → 补 URL + 触发补下（修复异步下载中断导致的封面缺失）
            if ((existing.getCoverPath() == null || existing.getCoverPath().isBlank())
                    && cover != null && !cover.isBlank()) {
                existing.setCoverUrl(cover);
                mediaMapper.updateById(existing);
                coverService.downloadAsync(existing.getId(), cover);
            }
            return new SyncResult(0, 1);
        }
        Media a = new Media();
        a.setTitle(nativeTitle);          // 占位：日文原名，用户后续可编辑成中文
        a.setOriginalTitle(nativeTitle);
        a.setYear(actualYear);
        a.setCoverUrl(cover);
        a.setMediaFormat("VIDEO");
        a.setStatus("WANT");
        a.setConfirmed(1);
        a.setCreatedAt(System.currentTimeMillis());
        mediaMapper.insert(a);
        if (cover != null && !cover.isBlank()) {
            coverService.downloadAsync(a.getId(), cover);
        }
        return new SyncResult(1, 0);
    }
}
