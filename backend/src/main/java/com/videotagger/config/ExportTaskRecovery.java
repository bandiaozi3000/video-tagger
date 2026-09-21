package com.videotagger.config;

import com.videotagger.entity.VideoExportTaskRow;
import com.videotagger.mapper.VideoExportTaskMapper;
import com.videotagger.service.VideoExportTaskService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * 导出任务启动接管（2026-09-21，设计规格 §5.4）。
 *
 * 上次后端进程死掉时，库里会留下 `RUNNING` 的任务、可能还有仍在跑的 node 渲染子进程、
 * 以及 `.work/` 里的工作目录。启动时一次性收拾：
 *
 * 1. `RUNNING` → `INTERRUPTED`（**不假装还在跑**；下期支持从 `work_dir` 续渲）；
 * 2. 表里记着的 `child_pid` 若还活着且确实是 node → 杀掉（治孤儿进程）；
 * 3. `.work/<id>` 里没有对应任务行、或对应任务已终结（DONE/CANCELLED）的目录 → 删掉；
 *    中断/失败（INTERRUPTED/ERROR）的**保留**，留给下期续渲或人工排查。
 *
 * 三步都只记 WARN 不抛异常：接管失败不能让应用起不来。
 */
@Component
public class ExportTaskRecovery {

    private static final Logger log = LoggerFactory.getLogger(ExportTaskRecovery.class);

    private final VideoExportTaskMapper mapper;

    public ExportTaskRecovery(VideoExportTaskMapper mapper) {
        this.mapper = mapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void recover() {
        long now = System.currentTimeMillis();
        markInterrupted(now);
        killLeftoverChildren();
        cleanOrphanWorkDirs();
    }

    private void markInterrupted(long now) {
        try {
            int n = mapper.markRunningAsInterrupted("后端重启中断（工作目录已保留）", now);
            if (n > 0) {
                log.warn("导出任务接管：{} 个 RUNNING 任务标记为 INTERRUPTED", n);
            }
        } catch (RuntimeException e) {
            log.warn("导出任务接管（标记中断）失败: {}", e.getMessage());
        }
    }

    private void killLeftoverChildren() {
        List<VideoExportTaskRow> rows;
        try {
            rows = mapper.listWithChildPid();
        } catch (RuntimeException e) {
            log.warn("导出任务接管（查子进程）失败: {}", e.getMessage());
            return;
        }
        for (VideoExportTaskRow row : rows) {
            Long pid = row.getChildPid();
            if (pid == null || pid <= 0) {
                continue;
            }
            try {
                ProcessHandle.of(pid).ifPresent(handle -> {
                    String cmd = handle.info().command().orElse("");
                    if (!cmd.toLowerCase().contains("node")) {
                        log.warn("导出任务 {} 记录的 pid {} 不是 node（{}），跳过", row.getId(), pid, cmd);
                        return;
                    }
                    handle.destroy();
                    if (handle.isAlive()) {
                        handle.destroyForcibly();
                    }
                    log.warn("导出任务接管：杀掉上次遗留的渲染子进程 pid={}（任务 {}）", pid, row.getId());
                });
                mapper.clearChildPid(row.getId(), System.currentTimeMillis());
            } catch (RuntimeException e) {
                log.warn("导出任务接管（杀 {}）失败: {}", pid, e.getMessage());
            }
        }
    }

    /** 无主工作目录：没有对应任务行，或任务已 DONE/CANCELLED（成功路径本该清掉但可能残留）。 */
    private void cleanOrphanWorkDirs() {
        Path base = Paths.get("data", "exports", ".work").toAbsolutePath();
        if (!Files.isDirectory(base)) {
            return;
        }
        Set<Long> keep = new HashSet<>();
        try {
            for (VideoExportTaskRow row : mapper.listRecent(500)) {
                // 2026-09-21 起：**只要任务行还在就保留工作目录**（含 DONE）——
                // 里面有分块产物与冻结输入，是"只重渲某一块"的唯一依据；
                // 删任务时才连块带成品一起清（用户拍板）。所以这里只清"没有任务行"的孤儿。
                keep.add(row.getId());
            }
        } catch (RuntimeException e) {
            log.warn("导出任务接管（查保留目录）失败，本次不清理: {}", e.getMessage());
            return;
        }
        try (Stream<Path> dirs = Files.list(base)) {
            dirs.filter(Files::isDirectory).forEach(dir -> {
                long id;
                try {
                    id = Long.parseLong(dir.getFileName().toString());
                } catch (NumberFormatException e) {
                    return;   // 非任务目录，不动
                }
                if (keep.contains(id)) {
                    return;
                }
                VideoExportTaskService.deleteWorkDir(dir);
                log.info("导出任务接管：清理无主工作目录 {}", dir.getFileName());
            });
        } catch (IOException e) {
            log.warn("导出任务接管（扫工作目录）失败: {}", e.getMessage());
        }
    }
}
