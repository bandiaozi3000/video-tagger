package com.videotagger.metadata;

import com.videotagger.entity.MetadataSyncTask;
import com.videotagger.entity.MetadataSyncTaskItem;
import com.videotagger.mapper.MetadataSyncTaskItemMapper;
import com.videotagger.mapper.MetadataSyncTaskMapper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MetadataSyncTaskExecutor {
    private static final long SUCCESS_RETENTION_MS = 30L * 24 * 60 * 60 * 1000;

    private final MetadataSyncTaskMapper taskMapper;
    private final MetadataSyncTaskItemMapper itemMapper;
    private final MetadataSyncService syncService;

    public MetadataSyncTaskExecutor(MetadataSyncTaskMapper taskMapper, MetadataSyncTaskItemMapper itemMapper,
                                    MetadataSyncService syncService) {
        this.taskMapper = taskMapper;
        this.itemMapper = itemMapper;
        this.syncService = syncService;
    }

    @Async("metadataSyncExecutor")
    public void runAsync(long taskDatabaseId) {
        run(taskDatabaseId);
    }

    void run(long taskDatabaseId) {
        MetadataSyncTask task = taskMapper.selectById(taskDatabaseId);
        if (task == null || isTerminal(task.getStatus())) return;
        long now = System.currentTimeMillis();
        task.setStatus("RUNNING");
        task.setStage("IMPORTING");
        if (task.getStartedAt() == null) task.setStartedAt(now);
        task.setUpdatedAt(now);
        taskMapper.updateById(task);

        List<MetadataSyncTaskItem> items = itemMapper.listByTask(taskDatabaseId);
        for (MetadataSyncTaskItem item : items) {
            if (!"QUEUED".equals(item.getStatus())) continue;
            executeItem(item);
        }
        finish(task, itemMapper.listByTask(taskDatabaseId));
    }

    private void executeItem(MetadataSyncTaskItem item) {
        long now = System.currentTimeMillis();
        item.setStatus("RUNNING");
        item.setStage("FETCHING");
        item.setAttempts(value(item.getAttempts()) + 1);
        item.setLastAttemptAt(now);
        item.setErrorMessage(null);
        item.setUpdatedAt(now);
        itemMapper.updateById(item);
        try {
            syncService.syncOne(item.getExternalId(), item.getAction(), item.getTargetMediaId());
            item.setStatus("SUCCEEDED");
            item.setStage("DONE");
            item.setErrorMessage(null);
        } catch (RuntimeException error) {
            item.setStatus("FAILED");
            item.setStage("FAILED");
            item.setErrorMessage(message(error));
        }
        item.setUpdatedAt(System.currentTimeMillis());
        itemMapper.updateById(item);
    }

    private void finish(MetadataSyncTask task, List<MetadataSyncTaskItem> items) {
        int processed = 0;
        int succeeded = 0;
        int failed = 0;
        int pendingReview = 0;
        int selected = 0;
        int creates = 0;
        int updates = 0;
        int links = 0;
        int skips = 0;
        for (MetadataSyncTaskItem item : items) {
            switch (item.getStatus()) {
                case "SUCCEEDED" -> { processed++; succeeded++; selected++; }
                case "FAILED" -> { processed++; failed++; selected++; }
                case "QUEUED", "RUNNING" -> selected++;
                case "SKIPPED" -> { processed++; skips++; }
                case "PENDING_REVIEW" -> { pendingReview++; skips++; }
                default -> { }
            }
            if (!"SKIPPED".equals(item.getStatus()) && !"PENDING_REVIEW".equals(item.getStatus())) {
                switch (item.getAction()) {
                    case "CREATE" -> creates++;
                    case "UPDATE" -> updates++;
                    case "LINK" -> links++;
                    default -> { }
                }
            }
        }
        long now = System.currentTimeMillis();
        task.setSelectedTotal(selected);
        task.setCreateCount(creates);
        task.setUpdateCount(updates);
        task.setLinkCount(links);
        task.setSkipCount(skips);
        task.setProcessed(processed);
        task.setSucceeded(succeeded);
        task.setFailed(failed);
        task.setPendingReview(pendingReview);
        task.setCompletedAt(now);
        task.setUpdatedAt(now);
        task.setStage("DONE");
        if (failed > 0) {
            task.setStatus(succeeded > 0 ? "PARTIAL" : "FAILED");
            task.setRetentionUntil(null);
        } else if (pendingReview > 0) {
            task.setStatus("PENDING_REVIEW");
            task.setRetentionUntil(null);
        } else {
            task.setStatus("DONE");
            task.setRetentionUntil(now + SUCCESS_RETENTION_MS);
        }
        taskMapper.updateById(task);
    }

    private static int value(Integer number) {
        return number == null ? 0 : number;
    }

    private static boolean isTerminal(String status) {
        return "DONE".equals(status) || "PARTIAL".equals(status) || "FAILED".equals(status)
                || "PENDING_REVIEW".equals(status);
    }

    private static String message(Throwable error) {
        String message = error.getMessage();
        if (message == null || message.isBlank()) message = error.getClass().getSimpleName();
        return message.length() <= 2000 ? message : message.substring(0, 2000);
    }
}