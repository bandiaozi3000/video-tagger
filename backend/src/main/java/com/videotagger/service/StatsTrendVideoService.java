package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.mapper.MediaMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * v0.32 第二部分：统计视频的取数 + 渲染 + 进度（**内存态**）。
 *
 * <p>刻意**不接**模板入口 / 草稿 / 导出队列 / 打包（规格 V3a）：那些是推荐视频导出的那套复杂度，
 * 这里只要「点一下 → 出片」。
 *
 * <p>渲染方式照抄 {@code RecommendVideoService}：起 node 跑 `remotion/scripts/render-trend.ts`
 * （脚本内 bundle → selectComposition → renderMedia），产物落 `data/exports/` ——
 * 该目录被 {@code WebConfig} 映射成 `/exports/**`，前端直接播放/下载。
 *
 * <p>⚠️ **封面必须先下载再内联成 data URI**：Remotion 的 {@code <Img>} 会 delayRender 等图，
 * 远程封面超时会让整支视频失败（2026-10-04 实测 `lain.bgm.tv` ERR_CONNECTION_TIMED_OUT → 28s 超时崩渲染）。
 * 下载失败就**不带封面**，绝不因此废掉整支出片。
 */
@Service
public class StatsTrendVideoService {

    private static final Logger log = LoggerFactory.getLogger(StatsTrendVideoService.class);
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    /** 封面内联上限：单张 1.2MB、合计 4MB（超了就丢封面，别把 props 撑死）。 */
    private static final int MAX_COVER_BYTES = 1_200_000;
    private static final int MAX_COVER_TOTAL_BYTES = 4_000_000;
    private static final int MAX_COVER_COUNT = 5;
    private static final Duration COVER_TIMEOUT = Duration.ofSeconds(8);

    private final StatsService statsService;
    private final ObjectMapper objectMapper;
    private final String nodePath;
    private final String remotionDir;
    private final String exportDir;
    /** 并发闸：渲染吃 CPU，同时只跑一支（规格 §5）。 */
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final Map<String, Task> tasks = new ConcurrentHashMap<>();

    public StatsTrendVideoService(StatsService statsService, ObjectMapper objectMapper,
                                  @Value("${videotagger.render.node-path:node}") String nodePath,
                                  @Value("${videotagger.render.remotion-dir:backend/remotion}") String remotionDir,
                                  @Value("${videotagger.export-dir:data/exports}") String exportDir) {
        this.statsService = statsService;
        this.objectMapper = objectMapper;
        this.nodePath = nodePath;
        this.remotionDir = remotionDir;
        this.exportDir = exportDir;
    }

    /** 任务态（内存，重启即丢 —— 规格已记，页面轮询有超时兜底）。 */
    public record Task(String id, String status, double progress, String outputPath, String url,
                       String error, String message, long startedAt) {
    }

    public Task start(TrendVideoRequest request) {
        if (request == null || request.lines() == null || request.lines().isEmpty()) {
            throw new IllegalArgumentException("至少要有 1 条线");
        }
        if (!busy.compareAndSet(false, true)) {
            throw new IllegalStateException("已经有一支统计视频在渲染中，等它渲完再点");
        }
        String id = "trend-" + LocalDateTime.now().format(STAMP);
        Task task = new Task(id, "RUNNING", 0d, null, null, null, "准备取数…", System.currentTimeMillis());
        tasks.put(id, task);
        Thread worker = new Thread(() -> {
            try {
                render(id, request);
            } catch (Exception e) {
                log.warn("统计视频渲染失败: {}", e.getMessage());
                tasks.computeIfPresent(id, (k, old) -> new Task(old.id(), "ERROR", old.progress(), null, null,
                        e.getMessage() == null ? e.toString() : e.getMessage(), "失败", old.startedAt()));
            } finally {
                busy.set(false);
            }
        }, "stats-trend-video");
        worker.setDaemon(true);
        worker.start();
        return task;
    }

    public Task status(String id) {
        Task t = tasks.get(id);
        if (t == null) {
            throw new NoSuchElementException("没有这个渲染任务：" + id);
        }
        return t;
    }

    private void render(String id, TrendVideoRequest request) throws Exception {
        Map<String, Object> input = buildInput(id, request);
        Path work = Paths.get(exportDir, "trend-work", id);
        Files.createDirectories(work);
        Path inputFile = work.resolve("trend-input.json");
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(inputFile.toFile(), input);

        Path output = Paths.get(exportDir, id + ".mp4").toAbsolutePath();
        Files.createDirectories(output.getParent());

        Path remotion = resolveRemotionDir();
        if (remotion == null) {
            throw new IllegalStateException("未找到 Remotion 工程（期望 <remotion-dir>/scripts/render-trend.ts）");
        }
        Path script = remotion.resolve("scripts").resolve("render-trend.ts");
        List<String> cmd = new ArrayList<>();
        cmd.add(nodePath);
        cmd.add(remotion.resolve("node_modules/tsx/dist/cli.mjs").toString());
        cmd.add(script.toString());
        cmd.add("--input");
        cmd.add(inputFile.toAbsolutePath().toString());
        cmd.add("--output");
        cmd.add(output.toString());
        cmd.add("--concurrency");
        cmd.add("2");

        tasks.computeIfPresent(id, (k, old) -> new Task(old.id(), "RUNNING", 0d, null, null, null, "Remotion 渲染中…", old.startedAt()));
        log.info("统计视频渲染开始: {} → {}", id, output);
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(remotion.toFile());
        pb.redirectErrorStream(true);
        Process process = pb.start();
        StringBuilder tail = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                handleLine(id, line);
                tail.append(line).append('\n');
                if (tail.length() > 8000) {
                    tail.delete(0, tail.length() - 8000);
                }
            }
        }
        int code = process.waitFor();
        if (code != 0 || !Files.isRegularFile(output)) {
            throw new IllegalStateException("Remotion 渲染失败（node 退出 " + code + "）: " + lastLines(tail.toString()));
        }
        long size = Files.size(output);
        tasks.computeIfPresent(id, (k, old) -> new Task(old.id(), "DONE", 1d, output.toString(),
                "/exports/" + output.getFileName(), null, "完成（" + (size / 1024) + " KB）", old.startedAt()));
        log.info("统计视频渲染完成: {} ({} KB)", output, size / 1024);
    }

    /** 解析脚本输出的一行：`{"progress":0.57,...}` 更新进度，其余（探帧/告警）只记日志。 */
    private void handleLine(String id, String line) {
        String s = line == null ? "" : line.trim();
        if (!s.startsWith("{")) {
            return;
        }
        try {
            Map<?, ?> json = objectMapper.readValue(s, Map.class);
            Object progress = json.get("progress");
            if (progress instanceof Number n) {
                tasks.computeIfPresent(id, (k, old) -> new Task(old.id(), "RUNNING", n.doubleValue(), null, null,
                        null, "渲染中 " + Math.round(n.doubleValue() * 100) + "%", old.startedAt()));
            }
        } catch (Exception ignored) {
            // 非 JSON 或半行：忽略（stderr 也并进来了，不能因为一行解析失败就中断渲染）
        }
    }

    /** 定位 Remotion 工程目录（IDE 从项目根、mvn 从 backend 启动，两者 cwd 不同）—— 同 RecommendVideoService 的做法。 */
    private Path resolveRemotionDir() {
        List<Path> candidates = List.of(
                Paths.get(remotionDir),
                Paths.get(remotionDir).toAbsolutePath(),
                Paths.get("backend/remotion").toAbsolutePath(),
                Paths.get("../backend/remotion").toAbsolutePath(),
                Paths.get("remotion").toAbsolutePath());
        for (Path candidate : candidates) {
            if (Files.isRegularFile(candidate.resolve("scripts/render-trend.ts"))) {
                return candidate.toAbsolutePath().normalize();
            }
        }
        return null;
    }

    private static String lastLines(String text) {
        String[] parts = text.split("\n");
        int from = Math.max(0, parts.length - 6);
        return String.join(" / ", java.util.Arrays.copyOfRange(parts, from, parts.length));
    }

    /** 组装 Remotion 的 inputProps：线 = 各筛选快照的逐年计数；refs = 横轴**最后一年**的代表作。 */
    Map<String, Object> buildInput(String id, TrendVideoRequest request) throws Exception {
        List<Map<String, Object>> lines = new ArrayList<>();
        List<Integer> axis = new ArrayList<>();
        for (TrendVideoRequest.Line line : request.lines()) {
            TrendVideoRequest.Snapshot f = line.filter() == null
                    ? new TrendVideoRequest.Snapshot(null, null, null, null, null, null, null, null, null, null, null)
                    : line.filter();
            StatsTrendResponse trend = trendOf(f);
            for (Integer y : trend.years()) {
                if (!axis.contains(y)) {
                    axis.add(y);
                }
            }
            List<Map<String, Object>> points = new ArrayList<>();
            for (StatsTrendResponse.Point p : trend.points()) {
                points.add(Map.of("year", p.year(), "count", p.count()));
            }
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("name", line.name() == null ? "未命名" : line.name());
            node.put("color", line.color() == null ? "#cba6f7" : line.color());
            node.put("points", points);
            lines.add(node);
        }
        axis.sort(Integer::compareTo);

        List<Map<String, Object>> refs = List.of();
        List<Map<String, Object>> yearCovers = List.of();
        if (!axis.isEmpty()) {
            TrendVideoRequest.Line first = request.lines().get(0);
            TrendVideoRequest.Snapshot f = first.filter() == null
                    ? new TrendVideoRequest.Snapshot(null, null, null, null, null, null, null, null, null, null, null)
                    : first.filter();
            refs = coverRefs(statsService.trendRefs(f.status(), f.format(), f.subcategoryId(), confirmedOf(f),
                    f.collectionId(), null, f.tagIds(), mode(f, "tagIds", "AND"), mode(f, "genres", "OR"),
                    mode(f, "collectionId", "OR"), f.q(), f.genres(), f.season(),
                    axis.get(axis.size() - 1), request.scoreSource(), 5), true);
            yearCovers = yearCovers(first.filter(), axis, request.scoreSource());
        }

        Map<String, Object> input = new LinkedHashMap<>();
        input.put("title", request.title() == null || request.title().isBlank() ? "媒体趋势" : request.title());
        input.put("chartType", "bar".equals(request.chartType()) ? "bar" : "line");
        input.put("theme", "dark".equals(request.theme()) ? "dark" : "light");
        input.put("secPerYear", request.secPerYear() == null ? 1.5 : request.secPerYear());
        input.put("holdSec", 3);
        input.put("years", axis);
        input.put("lines", lines);
        input.put("refs", refs);
        input.put("yearCovers", yearCovers);
        return input;
    }

    /** 每年第一名的代表作 → 封面内联（年份不在横轴上的丢弃）。 */
    List<Map<String, Object>> yearCovers(TrendVideoRequest.Snapshot f, List<Integer> axis, String scoreSource) {
        if (f == null) {
            return List.of();
        }
        List<MediaMapper.YearTopRef> tops = statsService.trendYearRefs(f.status(), f.format(), f.subcategoryId(),
                confirmedOf(f), f.collectionId(), null, null, f.tagIds(), mode(f, "tagIds", "AND"),
                mode(f, "genres", "OR"), mode(f, "collectionId", "OR"), f.q(), f.genres(), f.season(), scoreSource);
        List<Map<String, Object>> out = new ArrayList<>();
        int budget = MAX_YEAR_COVER_TOTAL_BYTES;
        for (MediaMapper.YearTopRef top : tops) {
            if (out.size() >= MAX_YEAR_COVER_COUNT || !axis.contains(top.year())) {
                continue;
            }
            String uri = downloadCover(top.externalCoverUrl(), budget, "200");   // 小头像用 r/200，几十 KB
            if (uri == null) {
                continue;
            }
            budget -= uri.length();
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("year", top.year());
            card.put("url", uri);
            out.add(card);
        }
        return out;
    }

    /**
     * 每年第一名的封面数量/体积上限。
     *
     * <p>`ponytail:` 44 年 × 几十 KB ≈ 2MB 可接受（props 过大曾把 Chrome 撑死过）；
     * 假如将来上到月粒度（上千个点），改成只给「当前可见区间」贴封面。
     */
    private static final int MAX_YEAR_COVER_COUNT = 44;
    private static final int MAX_YEAR_COVER_TOTAL_BYTES = 2_500_000;

    private StatsTrendResponse trendOf(TrendVideoRequest.Snapshot f) {
        return statsService.trend(f.status(), f.format(), f.subcategoryId(), confirmedOf(f), f.collectionId(),
                f.year(), null, f.tagIds(), mode(f, "tagIds", "AND"), mode(f, "genres", "OR"),
                mode(f, "collectionId", "OR"), f.q(), f.genres(), f.season());
    }

    /** 快照里的「只看待确认」→ `confirmed=0`（与媒体页同一口径；没勾就是 null = 不筛）。 */
    private static Integer confirmedOf(TrendVideoRequest.Snapshot f) {
        return Boolean.TRUE.equals(f.unconfirmed()) ? 0 : null;
    }

    private static String mode(TrendVideoRequest.Snapshot f, String key, String dflt) {
        if (f == null || f.mode() == null) {
            return dflt;
        }
        String v = switch (key) {
            case "tagIds" -> f.mode().tagIds();
            case "genres" -> f.mode().genres();
            default -> f.mode().collectionId();
        };
        return v == null || v.isBlank() ? dflt : v;
    }

    /**
     * 代表作 → 内联封面。
     *
     * @param download 是否下载封面（false = 只出文字卡；测试用，避免真联网）
     */
    List<Map<String, Object>> coverRefs(List<TrendRef> refs, boolean download) {
        List<Map<String, Object>> out = new ArrayList<>();
        int budget = MAX_COVER_TOTAL_BYTES;
        int n = 0;
        for (TrendRef r : refs) {
            if (out.size() >= MAX_COVER_COUNT) {
                break;
            }
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("title", r.title());
            card.put("bgmScore", r.bgmScore());
            card.put("bgmVotes", r.bgmVotes());
            card.put("personalRating", r.personalRating());
            card.put("clipCount", r.clipCount());
            String dataUri = null;
            if (download && n < MAX_COVER_COUNT) {
                dataUri = downloadCover(r.externalCoverUrl(), budget);
            }
            if (dataUri != null) {
                budget -= dataUri.length();
                n++;
            }
            card.put("coverUrl", dataUri);
            out.add(card);
        }
        return out;
    }

    /** 下载一张封面并转成 data URI；任何失败/超限都返回 null（不带封面，而不是让渲染挂掉）。 */
    private String downloadCover(String url, int budget) {
        return downloadCover(url, budget, "400");
    }

    /** 下载一张封面并转成 data URI（`size` = Bangumi 缩略图档位）；任何失败/超限返回 null（不带封面，不让渲染挂掉）。 */
    private String downloadCover(String url, int budget, String size) {
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            return null;
        }
        String small = url.replaceFirst("(https?://[^/]+/)(?!r/)", "$1r/" + size + "/");
        for (String candidate : List.of(small, url)) {
            try {
                HttpClient client = HttpClient.newBuilder().connectTimeout(COVER_TIMEOUT).build();
                HttpRequest req = HttpRequest.newBuilder(URI.create(candidate)).timeout(COVER_TIMEOUT)
                        .header("User-Agent", "video-tagger/0.32").GET().build();
                HttpResponse<byte[]> resp = client.send(req, HttpResponse.BodyHandlers.ofByteArray());
                byte[] body = resp.body();
                if (resp.statusCode() != 200 || body == null || body.length == 0 || body.length > MAX_COVER_BYTES) {
                    continue;
                }
                String mime = resp.headers().firstValue("Content-Type").orElse("image/jpeg");
                String uri = "data:" + (mime.startsWith("image/") ? mime : "image/jpeg") + ";base64,"
                        + Base64.getEncoder().encodeToString(body);
                if (uri.length() > budget) {
                    return null;
                }
                return uri;
            } catch (IOException | InterruptedException e) {
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                    return null;
                }
                // 试下一个候选（缩略图取不到就试原图）
            }
        }
        return null;
    }

    /** 给测试/调试用：不下载封面，只出文字卡。 */
    List<Map<String, Object>> textOnlyRefs(List<TrendRef> refs) {
        return coverRefs(refs, false);
    }
}
