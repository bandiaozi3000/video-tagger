package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.VideoExportTaskRow;
import com.videotagger.mapper.VideoExportTaskMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

/**
 * 视频导出异步任务：点击导出 → 建任务(RUNNING) → 后台渲染 → 完成(DONE/ERROR)，
 * 产物持久在 data/exports，可被列表查看/打开文件/打开所在文件夹/删除记录。
 *
 * 2026-09-21（Flyway V35）：任务表从内存搬到 MySQL —— 后端重启不再丢任务；
 * 工作目录改成持久位置 `data/exports/.work/<id>`（**成功才清、中断/取消保留**）；
 * 新增取消（杀渲染子进程）与启动接管（见 `ExportTaskRecovery`）。
 *
 * `work_dir` / `child_pid` / `request_json` 三个字段本期只写不读，是给**下期分块续渲**预留的入口：
 * 有了它们，续渲不必再改表（见设计规格 `docs/superpowers/specs/2026-09-21-export-task-persistence-design.md`）。
 */
@Service
public class VideoExportTaskService {

    private static final Logger log = LoggerFactory.getLogger(VideoExportTaskService.class);

    /** 进度写库节流：10s 或 1% 变化才写（渲染脚本 4s 一上报，逐条写库太吵）。 */
    private static final long PROGRESS_WRITE_INTERVAL_MS = 10_000;

    /** 一条视频导出任务记录（**API DTO**，形状保持不变；DB 行见 `VideoExportTaskRow`）。 */
    public record VideoExportTask(long id, String title, int mediaCount, String status, String message,
                                  String filePath, String format, long createdAt, long finishedAt, int progress,
                                  int chunksDone, int chunksTotal, String stageText, String boundaryFrames) {

        /** 兼容旧构造（没有进度/分块信息时按 0/空）。 */
        public VideoExportTask(long id, String title, int mediaCount, String status, String message,
                               String filePath, String format, long createdAt, long finishedAt) {
            this(id, title, mediaCount, status, message, filePath, format, createdAt, finishedAt, 0, 0, 0, null, null);
        }
    }

    private final RecommendVideoService videoService;
    private final VideoExportTaskMapper mapper;
    private final ObjectMapper objectMapper;

    /** 已请求取消的任务 id：渲染线程收尾时据此把结果写成 CANCELLED 而不是 ERROR。 */
    private final java.util.Set<Long> cancelled = ConcurrentHashMap.newKeySet();

    /** 节流用：任务 id → [上次写库时间, 上次写的百分比]。 */
    private final Map<Long, long[]> progressMark = new ConcurrentHashMap<>();

    /** 自身代理：@Async 经 Spring 代理才生效，同类自调用会绕过代理变成同步渲染（POST 卡死）。 */
    @Lazy
    @Autowired
    private VideoExportTaskService self;

    public VideoExportTaskService(RecommendVideoService videoService, VideoExportTaskMapper mapper,
                                  ObjectMapper objectMapper) {
        this.videoService = videoService;
        this.mapper = mapper;
        this.objectMapper = objectMapper;
    }

    public VideoExportTask create(List<Long> ids, String title, String format, String resolution,
                                  List<String> bgmPaths, List<RecommendService.BgmTrack> bgmTracks,
                                  String groupBy, String groupStyle, String subtitle, String coverSize,
                                  List<Long> openingIds, List<Long> featuredIds, String intro, RecommendService.Durations durations,
                                  String endingTitle, String endingText, String bgColor, List<String> bgImages,
                                  Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                                  String prologueTitle, String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                                  Integer bgmScale,
                                  Integer bgmX, Integer bgmY, String brandTitle, Integer perScreen,
                                  Map<String, Boolean> detailShow, String preset,
                                  Map<Long, RecommendMediaClips> requestedClips, Integer seed, Integer clipVolume, String bgmRange,
                                  String stingPath, Integer stingVolume) {
        long now = System.currentTimeMillis();
        VideoExportTaskRow row = new VideoExportTaskRow();
        row.setTitle(title == null || title.isBlank() ? "推荐视频" : title);
        row.setMediaCount(ids == null ? 0 : ids.size());
        row.setStatus("PENDING");
        row.setFormat(format);
        row.setProgress(0);
        row.setRequestJson(requestSnapshot(ids, title, format, resolution, groupBy, groupStyle, durations, bgmTracks));
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        mapper.insert(row);
        long id = row.getId();
        /* 走 self 代理调用，@Async 才切到 videoExportExecutor 顺序渲染；直接 this.runAsync 会同步阻塞 POST */
        self.runAsync(id, ids, title, format, resolution, bgmPaths, bgmTracks, groupBy, groupStyle,
                subtitle, coverSize, openingIds, featuredIds, intro, durations, endingTitle, endingText, bgColor, bgImages,
                bgRotationSec, bgOpacity, bgBlur, bgBrightness, prologueTitle,
                groupSort, openingSpeed, endingScrollSpeed,
                bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow, preset, requestedClips, seed, clipVolume, bgmRange,
                stingPath, stingVolume);
        return toDto(mapper.selectById(id));
    }

    @Async("videoExportExecutor")
    public void runAsync(long id, List<Long> ids, String title, String format, String resolution,
                         List<String> bgmPaths, List<RecommendService.BgmTrack> bgmTracks,
                         String groupBy, String groupStyle, String subtitle, String coverSize,
                         List<Long> openingIds, List<Long> featuredIds, String intro, RecommendService.Durations durations,
                         String endingTitle, String endingText, String bgColor, List<String> bgImages,
                                  Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                         String prologueTitle, String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                         Integer bgmScale,
                         Integer bgmX, Integer bgmY, String brandTitle, Integer perScreen,
                         Map<String, Boolean> detailShow, String preset,
                         Map<Long, RecommendMediaClips> requestedClips, Integer seed, Integer clipVolume, String bgmRange,
                                  String stingPath, Integer stingVolume) {
        long now = System.currentTimeMillis();
        Path work = workDirOf(id);
        try {
            mapper.setWorkDir(id, work.toString(), now);
            mapper.markRunning(id, now);
            Path out = videoService.render(ids, title, format, resolution, bgmPaths, bgmTracks,
                    groupBy, groupStyle, subtitle, coverSize, openingIds, featuredIds, intro, durations,
                    endingTitle, endingText, bgColor, bgImages, bgRotationSec, bgOpacity, bgBlur, bgBrightness, prologueTitle,
                    groupSort, openingSpeed, endingScrollSpeed,
                    bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow, preset, requestedClips, seed, clipVolume, bgmRange,
                    stingPath, stingVolume, work, callbacks(id));
            boolean wasCancelled = cancelled.remove(id);
            mapper.finishIfActive(id, "DONE", null, out.toString(), System.currentTimeMillis());
            log.info("视频导出任务 {} 完成: {}{}", id, out, wasCancelled ? "（渲染结束前收到过取消请求，产物仍已产出）" : "");
            /* 工作目录**默认保留**（2026-09-21 用户拍板）：里面有分块产物与冻结输入，
               是"只重渲某一块"的唯一依据；删任务时才连块带成品一起清。 */
        } catch (RecommendVideoService.RenderPausedException e) {
            // 暂停（用户拍板 Q2：块边界停）：**保留工作目录与已完成块**，状态留给 pause()/cancel() 写
            log.info("视频导出任务 {} 已暂停: {}", id, e.getMessage());
        } catch (Exception e) {
            long end = System.currentTimeMillis();
            if (cancelled.remove(id)) {
                // cancel() 已经把状态写成 CANCELLED，这里不覆盖（只补 message 里的原因）
                log.info("视频导出任务 {} 已取消: {}", id, e.getMessage());
            } else {
                log.error("视频导出任务 {} 失败", id, e);
                mapper.finishIfActive(id, "ERROR", e.getMessage() == null ? "导出失败" : e.getMessage(), null, end);
            }
        } finally {
            progressMark.remove(id);
            /* 清理 BGM 临时文件 */
            if (bgmPaths != null) {
                for (String p : bgmPaths) {
                    try {
                        Files.deleteIfExists(Path.of(p));
                    } catch (IOException ignored) {
                    }
                }
            }
        }
    }

    /** 渲染回调：子进程 pid + 进度（节流写库）+ 分块计数/状态文案 + 暂停检查。 */
    private RecommendVideoService.RenderCallbacks callbacks(long id) {
        return new RecommendVideoService.RenderCallbacks() {
            @Override
            public void onPid(long pid) {
                try {
                    mapper.setChildPid(id, pid, System.currentTimeMillis());
                } catch (RuntimeException e) {
                    log.warn("记录渲染子进程 pid 失败（不影响渲染）: {}", e.getMessage());
                }
            }

            @Override
            public void onProgress(int percent) {
                writeProgress(id, percent);
            }

            @Override
            public void onBoundaries(java.util.List<Integer> frames) {
                try {
                    // 存成 JSON 数组字符串：局部重渲前拿它与"当前草稿算出的边界"比对
                    StringBuilder json = new StringBuilder("[");
                    for (int i = 0; i < frames.size(); i++) {
                        if (i > 0) json.append(',');
                        json.append(frames.get(i));
                    }
                    mapper.setBoundaryFrames(id, json.append(']').toString(), System.currentTimeMillis());
                } catch (RuntimeException e) {
                    log.warn("写分块边界失败（不影响渲染）: {}", e.getMessage());
                }
            }

            @Override
            public void onChunks(int done, int total) {
                try {
                    mapper.updateChunks(id, done, total, null, System.currentTimeMillis());
                } catch (RuntimeException e) {
                    log.warn("写分块进度失败（不影响渲染）: {}", e.getMessage());
                }
            }

            @Override
            public void onStage(String text) {
                try {
                    mapper.updateStage(id, text, System.currentTimeMillis());
                } catch (RuntimeException e) {
                    log.warn("写状态文案失败（不影响渲染）: {}", e.getMessage());
                }
            }

            @Override
            public boolean shouldContinue() {
                // 每块渲完查一次库：用户点了暂停/取消 → 停下（块文件保留，可续）
                VideoExportTaskRow row = mapper.selectById(id);
                return row != null && "RUNNING".equals(row.getStatus());
            }
        };
    }

    /**
     * 进度写库（节流）：距上次写库 ≥ 10s 或百分比变化 ≥ 1% 才写；只在 RUNNING 时生效。
     * 写库失败只记 WARN —— 渲染不能因为记不住进度而挂掉。
     */
    private void writeProgress(long id, int percent) {
        int pct = Math.max(0, Math.min(100, percent));
        long now = System.currentTimeMillis();
        long[] mark = progressMark.get(id);
        if (mark != null && pct < 100 && now - mark[0] < PROGRESS_WRITE_INTERVAL_MS && Math.abs(pct - mark[1]) < 1) {
            return;
        }
        progressMark.put(id, new long[]{now, pct});
        try {
            mapper.updateProgress(id, pct, now);
        } catch (RuntimeException e) {
            log.warn("写导出进度失败（不影响渲染）: {}", e.getMessage());
        }
    }

    /** 任务列表（按创建时间倒序）。 */
    public List<VideoExportTask> list() {
        return mapper.listRecent(50).stream().map(VideoExportTaskService::toDto).toList();
    }

    public VideoExportTask get(long id) {
        VideoExportTaskRow row = mapper.selectById(id);
        if (row == null) {
            throw new NoSuchElementException("导出任务不存在: " + id);
        }
        return toDto(row);
    }

    /**
     * 暂停（用户拍板 Q2：**块边界停** —— Remotion 停不到帧中间，当前块跑完即停）。
     * 已完成块留在工作目录里，`resume()` 从下一块接着渲。
     */
    public boolean pause(long id) {
        VideoExportTaskRow row = mapper.selectById(id);
        if (row == null) {
            throw new NoSuchElementException("导出任务不存在: " + id);
        }
        if (!"RUNNING".equals(row.getStatus())) {
            return false;
        }
        // 状态直接写 PAUSED：渲染线程每块渲完查一次库（shouldContinue），看到非 RUNNING 就停在块边界
        mapper.pauseTask(id, System.currentTimeMillis());
        log.info("导出任务 {} 请求暂停（当前块渲完后停）", id);
        return true;
    }

    /**
     * 继续：从工作目录里已有的块之后接着渲（设计规格 §11 的续渲入口）。
     * 支持 PAUSED（用户暂停）与 INTERRUPTED（后端重启中断）。
     */
    public boolean resume(long id) {
        VideoExportTaskRow row = mapper.selectById(id);
        if (row == null) {
            throw new NoSuchElementException("导出任务不存在: " + id);
        }
        if (!"PAUSED".equals(row.getStatus()) && !"INTERRUPTED".equals(row.getStatus())) {
            return false;
        }
        if (row.getWorkDir() == null || row.getWorkDir().isBlank()
                || !Files.exists(Path.of(row.getWorkDir(), "render-input.json"))) {
            throw new IllegalStateException("工作目录或 render-input.json 已丢失，无法续渲（请重新导出）");
        }
        cancelled.remove(id);
        mapper.markRunning(id, System.currentTimeMillis());
        self.resumeAsync(id);
        log.info("导出任务 {} 从工作目录续渲: {}", id, row.getWorkDir());
        return true;
    }

    /** 续渲的异步执行体：**不重做素材准备**，直接用工作目录里的 render-input.json 接着分块渲。 */
    @Async("videoExportExecutor")
    public void resumeAsync(long id) {
        resumeAsync(id, false);
    }

    /**
     * 续渲/重渲执行体。
     *
     * @param overwrite true = 写回任务记录的产物路径（**局部重渲直接覆盖原成品**，用户拍板）
     */
    @Async("videoExportExecutor")
    public void resumeAsync(long id, boolean overwrite) {
        VideoExportTaskRow row = mapper.selectById(id);
        if (row == null || row.getWorkDir() == null) {
            return;
        }
        Path work = Path.of(row.getWorkDir());
        String fmt = row.getFormat() == null ? "MP4" : row.getFormat();
        try {
            Path target = overwrite && row.getFilePath() != null ? Path.of(row.getFilePath()) : null;
            Path out = videoService.resumeFromWorkDir(work, fmt, callbacks(id), target);
            mapper.finishIfActive(id, "DONE", null, out.toString(), System.currentTimeMillis());
            log.info("导出任务 {} 续渲完成: {}", id, out);
        } catch (RecommendVideoService.RenderPausedException e) {
            log.info("导出任务 {} 再次暂停: {}", id, e.getMessage());
        } catch (Exception e) {
            if (cancelled.remove(id)) {
                log.info("导出任务 {} 已取消: {}", id, e.getMessage());
            } else {
                log.error("导出任务 {} 续渲失败", id, e);
                mapper.finishIfActive(id, "ERROR", e.getMessage() == null ? "续渲失败" : e.getMessage(), null,
                        System.currentTimeMillis());
            }
        } finally {
            progressMark.remove(id);
        }
    }

    /**
     * 取消任务：排队中/渲染中都支持。杀渲染子进程（校验进程名含 node，防 Windows pid 复用误杀），
     * 状态立刻写成 CANCELLED（渲染线程收尾时不再覆盖）。
     *
     * @return true = 确实取消了；false = 任务已结束（无事可做）
     */
    public boolean cancel(long id) {
        VideoExportTaskRow row = mapper.selectById(id);
        if (row == null) {
            throw new NoSuchElementException("导出任务不存在: " + id);
        }
        if (!"PENDING".equals(row.getStatus()) && !"RUNNING".equals(row.getStatus())) {
            return false;
        }
        cancelled.add(id);
        killChild(row.getChildPid());
        mapper.finishIfActive(id, "CANCELLED", "已取消（工作目录保留）", null, System.currentTimeMillis());
        log.info("导出任务 {} 已取消（childPid={}）", id, row.getChildPid());
        return true;
    }

    /** 杀渲染子进程：校验进程名含 node，避免 Windows 上 pid 复用杀到无关进程。 */
    private void killChild(Long pid) {
        if (pid == null || pid <= 0) {
            return;
        }
        try {
            ProcessHandle.of(pid).ifPresent(handle -> {
                String cmd = handle.info().command().orElse("");
                if (!cmd.toLowerCase().contains("node")) {
                    log.warn("pid {} 不是 node 进程（{}），跳过终止", pid, cmd);
                    return;
                }
                handle.destroy();
                if (handle.isAlive()) {
                    handle.destroyForcibly();
                }
            });
        } catch (RuntimeException e) {
            log.warn("终止渲染子进程 {} 失败: {}", pid, e.getMessage());
        }
    }

    /**
     * 局部重渲：删掉第 `chunkIndex` 块的产物 → 触发续渲（自动跳过错过的块，**只补这一块**）→
     * 重新拼接 → **覆盖原成品**（用户 2026-09-21 拍板）。
     *
     * 调用方（编辑器）必须先做安全校验：当前草稿的段边界必须与任务快照一致，
     * 否则旧块在新时间轴上对应别的内容，只能整片重渲。
     */
    public boolean rerenderChunk(long id, int chunkIndex) {
        VideoExportTaskRow row = mapper.selectById(id);
        if (row == null) {
            throw new NoSuchElementException("导出任务不存在: " + id);
        }
        if ("RUNNING".equals(row.getStatus()) || "PENDING".equals(row.getStatus())) {
            throw new IllegalStateException("任务正在渲染中，先等它结束或取消");
        }
        if (row.getWorkDir() == null || !Files.exists(Path.of(row.getWorkDir(), "render-input.json"))) {
            throw new IllegalStateException("工作目录或 render-input.json 已丢失，无法局部重渲（请整片重渲）");
        }
        Path work = Path.of(row.getWorkDir());
        Path chunkFile = work.resolve(RenderChunks.chunkFileName(chunkIndex));
        if (!Files.exists(chunkFile)) {
            throw new IllegalStateException("第 " + (chunkIndex + 1) + " 块产物不存在，无法局部重渲（请整片重渲）");
        }
        try {
            Files.deleteIfExists(chunkFile);
        } catch (IOException e) {
            throw new IllegalStateException("删除第 " + (chunkIndex + 1) + " 块产物失败: " + e.getMessage(), e);
        }
        cancelled.remove(id);
        mapper.markRunningFromTerminal(id, System.currentTimeMillis());
        self.resumeAsync(id, true);
        log.info("导出任务 {} 局部重渲第 {} 块（完成后覆盖原成品）", id, chunkIndex + 1);
        return true;
    }

    /**
     * 删除任务记录（**删任务行 + 工作目录 + 成品文件** —— 用户 2026-09-21 拍板）。
     * 运行中/排队中先取消再删。
     */
    public void delete(long id) {
        VideoExportTaskRow row = mapper.selectById(id);
        if (row == null) {
            throw new NoSuchElementException("导出任务不存在: " + id);
        }
        if ("PENDING".equals(row.getStatus()) || "RUNNING".equals(row.getStatus())) {
            throw new IllegalStateException("任务正在排队/渲染中，请先取消再删除");
        }
        mapper.deleteById(id);
        if (row.getWorkDir() != null && !row.getWorkDir().isBlank()) {
            deleteWorkDir(Path.of(row.getWorkDir()));
        }
        deleteProduct(row.getFilePath());
        mapper.clearChildPid(id, System.currentTimeMillis());
    }

    /** 删成品文件（Windows 上被播放器/资源管理器占用时会短暂失败 → 重试几次）。 */
    private void deleteProduct(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return;
        }
        Path path = Path.of(filePath);
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                Files.deleteIfExists(path);
                return;
            } catch (java.nio.file.AccessDeniedException e) {
                if (attempt < 2) {
                    try {
                        Thread.sleep(300);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                } else {
                    log.warn("成品文件被占用，删除失败（请关闭预览后手动清理）: {}", path);
                }
            } catch (IOException e) {
                log.warn("删除成品失败 {}: {}", path, e.getMessage());
                return;
            }
        }
    }

    /** 打开产物文件（folder=true 打开所在文件夹并选中）。Windows 资源管理器。 */
    public void open(long id, boolean folder) {
        VideoExportTask t = get(id);
        if (t.filePath() == null || t.filePath().isBlank()) {
            throw new IllegalStateException("任务未完成，无产物文件");
        }
        try {
            List<String> cmd = new ArrayList<>();
            cmd.add("explorer");
            cmd.add(folder ? "/select," + t.filePath() : t.filePath());
            new ProcessBuilder(cmd).start();
        } catch (IOException e) {
            throw new IllegalStateException("打开失败: " + e.getMessage(), e);
        }
    }

    // —— 内部工具 ——

    /** 任务工作目录：`data/exports/.work/<id>`（与产物同盘；成功才清，中断保留）。 */
    static Path workDirOf(long id) {
        Path base = Paths.get("data", "exports", ".work").toAbsolutePath();
        Path dir = base.resolve(String.valueOf(id));
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new IllegalStateException("创建导出工作目录失败: " + e.getMessage(), e);
        }
        return dir;
    }

    /** 递归删目录（失败只记 WARN：目录残留比中断导出好得多）。 */
    public static void deleteWorkDir(Path root) {
        if (root == null || !Files.exists(root)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(root)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // 被占用就留着，下次启动接管再清
                }
            });
        } catch (IOException e) {
            log.warn("清理工作目录失败 {}: {}", root, e.getMessage());
        }
    }

    /**
     * 请求快照（**剥掉 base64**）：BGM/转场音只记文件名，素材真身在任务工作目录里。
     * 本期只入库不消费，供下期续渲直接重建请求。
     */
    private String requestSnapshot(List<Long> ids, String title, String format, String resolution,
                                   String groupBy, String groupStyle, RecommendService.Durations durations,
                                   List<RecommendService.BgmTrack> bgmTracks) {
        try {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("ids", ids);
            snapshot.put("title", title);
            snapshot.put("format", format);
            snapshot.put("resolution", resolution);
            snapshot.put("groupBy", groupBy);
            snapshot.put("groupStyle", groupStyle);
            snapshot.put("durations", durations);
            snapshot.put("bgmNames", bgmTracks == null ? List.of()
                    : bgmTracks.stream().map(RecommendService.BgmTrack::name).toList());
            snapshot.put("note", "base64 已剥离；BGM/转场音素材见任务工作目录（bgm-*.ext / sting-0.ext）");
            return objectMapper.writeValueAsString(snapshot);
        } catch (RuntimeException | IOException e) {
            log.warn("生成请求快照失败（不影响导出）: {}", e.getMessage());
            return null;
        }
    }

    private static VideoExportTask toDto(VideoExportTaskRow row) {
        return new VideoExportTask(row.getId(),
                row.getTitle() == null ? "推荐视频" : row.getTitle(),
                row.getMediaCount() == null ? 0 : row.getMediaCount(),
                row.getStatus(),
                row.getMessage(),
                row.getFilePath(),
                row.getFormat(),
                row.getCreatedAt() == null ? 0 : row.getCreatedAt(),
                row.getFinishedAt() == null ? 0 : row.getFinishedAt(),
                row.getProgress() == null ? 0 : row.getProgress(),
                row.getChunksDone() == null ? 0 : row.getChunksDone(),
                row.getChunksTotal() == null ? 0 : row.getChunksTotal(),
                row.getStageText(),
                row.getBoundaryFrames());
    }
}
