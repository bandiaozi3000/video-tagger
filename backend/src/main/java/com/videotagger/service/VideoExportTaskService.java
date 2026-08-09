package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
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

    public VideoExportTaskService(RecommendVideoService videoService) {
        this.videoService = videoService;
    }

    /** 创建任务（RUNNING）并异步执行渲染，立即返回任务记录。 */
    public VideoExportTask create(List<Long> ids, String title, String format, String resolution,
                                  List<String> bgmPaths, List<RecommendService.BgmTrack> bgmTracks,
                                  String groupBy, String groupStyle, String subtitle, String coverSize,
                                  List<Long> openingIds, String intro, RecommendService.Durations durations,
                                  String endingTitle, String endingText, String bgColor, String bgImage,
                                  String prologueTitle) {
        long id = seq.getAndIncrement();
        VideoExportTask t = new VideoExportTask(id, title == null || title.isBlank() ? "推荐视频" : title,
                ids == null ? 0 : ids.size(), "RUNNING", null, null, format, System.currentTimeMillis(), 0);
        tasks.put(id, t);
        runAsync(id, ids, title, format, resolution, bgmPaths, bgmTracks, groupBy, groupStyle,
                subtitle, coverSize, openingIds, intro, durations, endingTitle, endingText, bgColor, bgImage, prologueTitle);
        return t;
    }

    @Async("syncExecutor")
    public void runAsync(long id, List<Long> ids, String title, String format, String resolution,
                         List<String> bgmPaths, List<RecommendService.BgmTrack> bgmTracks,
                         String groupBy, String groupStyle, String subtitle, String coverSize,
                         List<Long> openingIds, String intro, RecommendService.Durations durations,
                         String endingTitle, String endingText, String bgColor, String bgImage,
                         String prologueTitle) {
        try {
            Path out = videoService.render(ids, title, format, resolution, bgmPaths, bgmTracks,
                    groupBy, groupStyle, subtitle, coverSize, openingIds, intro, durations,
                    endingTitle, endingText, bgColor, bgImage, prologueTitle);
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

    /** 删除记录（同步删除产物文件）。 */
    public void delete(long id) {
        VideoExportTask t = tasks.remove(id);
        if (t == null) {
            throw new NoSuchElementException("导出任务不存在: " + id);
        }
        if (t.filePath() != null) {
            try {
                Files.deleteIfExists(Path.of(t.filePath()));
            } catch (IOException ignored) {
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
