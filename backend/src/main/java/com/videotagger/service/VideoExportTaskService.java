package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 视频导出异步任务：点击导出 → 建任务(RUNNING) → 后台渲染 → 完成(DONE/ERROR)，
 * 产物持久在 data/exports，可被列表查看/打开文件/打开所在文件夹/删除记录。
 * 内存任务表（重启丢失，参照 omofuna 同步任务）。
 */
@Service
public class VideoExportTaskService {

    private static final Logger log = LoggerFactory.getLogger(VideoExportTaskService.class);

    /** 一条视频导出任务记录。 */
    public record VideoExportTask(long id, String title, int mediaCount, String status, String message,
                                  String filePath, String format, long createdAt, long finishedAt) {
    }

    private final RecommendVideoService videoService;
    private final ConcurrentHashMap<Long, VideoExportTask> tasks = new ConcurrentHashMap<>();
    private final AtomicLong seq = new AtomicLong(1);

    /** 自身代理：@Async 经 Spring 代理才生效，同类自调用会绕过代理变成同步渲染（POST 卡死）。 */
    @Lazy
    @Autowired
    private VideoExportTaskService self;

    public VideoExportTaskService(RecommendVideoService videoService) {
        this.videoService = videoService;
    }

    /** 创建任务（RUNNING）并异步执行渲染，立即返回任务记录。 */
    public VideoExportTask create(List<Long> ids, String title, String format, String resolution,
                                  List<String> bgmPaths, List<RecommendService.BgmTrack> bgmTracks,
                                  String groupBy, String groupStyle, String subtitle, String coverSize,
                                  List<Long> openingIds, String intro, RecommendService.Durations durations,
                                  String endingTitle, String endingText, String bgColor, List<String> bgImages,
                                  Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                                  String prologueTitle, String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                                  Integer bgmScale,
                                  Integer bgmX, Integer bgmY, String brandTitle, Integer perScreen,
                                  Map<String, Boolean> detailShow) {
        long id = seq.getAndIncrement();
        VideoExportTask t = new VideoExportTask(id, title == null || title.isBlank() ? "推荐视频" : title,
                ids == null ? 0 : ids.size(), "RUNNING", null, null, format, System.currentTimeMillis(), 0);
        tasks.put(id, t);
        /* 走 self 代理调用，@Async 才切到 videoExportExecutor 顺序渲染；直接 this.runAsync 会同步阻塞 POST */
        self.runAsync(id, ids, title, format, resolution, bgmPaths, bgmTracks, groupBy, groupStyle,
                subtitle, coverSize, openingIds, intro, durations, endingTitle, endingText, bgColor, bgImages,
                bgRotationSec, bgOpacity, bgBlur, bgBrightness, prologueTitle,
                groupSort, openingSpeed, endingScrollSpeed,
                bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow);
        return t;
    }

    @Async("videoExportExecutor")
    public void runAsync(long id, List<Long> ids, String title, String format, String resolution,
                         List<String> bgmPaths, List<RecommendService.BgmTrack> bgmTracks,
                         String groupBy, String groupStyle, String subtitle, String coverSize,
                         List<Long> openingIds, String intro, RecommendService.Durations durations,
                         String endingTitle, String endingText, String bgColor, List<String> bgImages,
                                  Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                         String prologueTitle, String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                         Integer bgmScale,
                         Integer bgmX, Integer bgmY, String brandTitle, Integer perScreen,
                         Map<String, Boolean> detailShow) {
        try {
            Path out = videoService.render(ids, title, format, resolution, bgmPaths, bgmTracks,
                    groupBy, groupStyle, subtitle, coverSize, openingIds, intro, durations,
                    endingTitle, endingText, bgColor, bgImages, bgRotationSec, bgOpacity, bgBlur, bgBrightness, prologueTitle,
                    groupSort, openingSpeed, endingScrollSpeed,
                    bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow);
            finish(id, "DONE", null, out.toString());
            log.info("视频导出任务 {} 完成: {}", id, out);
        } catch (Exception e) {
            log.error("视频导出任务 {} 失败", id, e);
            finish(id, "ERROR", e.getMessage() == null ? "导出失败" : e.getMessage(), null);
        } finally {
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

    /** 任务列表（按创建时间倒序）。 */
    public List<VideoExportTask> list() {
        List<VideoExportTask> all = new ArrayList<>(tasks.values());
        all.sort((a, b) -> Long.compare(b.createdAt(), a.createdAt()));
        return all;
    }

    public VideoExportTask get(long id) {
        VideoExportTask t = tasks.get(id);
        if (t == null) {
            throw new NoSuchElementException("导出任务不存在: " + id);
        }
        return t;
    }

    /** 删除记录（同步删除产物文件）。文件被占用时重试数次，仍失败记日志供排查。 */
    public void delete(long id) {
        VideoExportTask t = tasks.remove(id);
        if (t == null) {
            throw new NoSuchElementException("导出任务不存在: " + id);
        }
        if (t.filePath() != null) {
            Path p = Path.of(t.filePath());
            for (int i = 0; i < 3; i++) {
                try {
                    Files.deleteIfExists(p);
                    return;
                } catch (java.nio.file.AccessDeniedException e) {
                    // Windows：文件被播放器/资源管理器/索引服务打开时删除会失败（待删标记可能显示 0KB），短暂重试
                    if (i < 2) {
                        try {
                            Thread.sleep(300);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            return;
                        }
                    } else {
                        log.warn("导出产物文件被占用，删除失败（请关闭预览后手动清理）: {}", p);
                    }
                } catch (IOException ignored) {
                    return;
                }
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

    private void finish(long id, String status, String message, String filePath) {
        VideoExportTask cur = tasks.get(id);
        if (cur == null) {
            return;
        }
        VideoExportTask next = new VideoExportTask(id, cur.title(), cur.mediaCount(), status, message,
                filePath, cur.format(), cur.createdAt(), System.currentTimeMillis());
        tasks.put(id, next);
    }
}
