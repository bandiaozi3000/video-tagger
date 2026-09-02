package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.VideoSourceTask;
import com.videotagger.entity.VideoSourceTaskItem;
import com.videotagger.mapper.VideoSourceTaskItemMapper;
import com.videotagger.mapper.VideoSourceTaskMapper;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class VideoSourceTaskService implements ApplicationRunner {
    private static final List<String> STATES = List.of("QUEUED", "RESOLVING", "RUNNING", "PAUSED", "VERIFYING", "COMPLETED", "FAILED", "CANCELED");
    private static final List<String> TYPES = List.of("PROBE", "DOWNLOAD_EPISODE", "DOWNLOAD_RANGE", "VERIFY_ASSET", "MATERIALIZE_CLIP", "CALIBRATE", "CLEANUP_CACHE");
    private final VideoSourceTaskMapper taskMapper;
    private final VideoSourceTaskItemMapper itemMapper;

    public VideoSourceTaskService(VideoSourceTaskMapper taskMapper, VideoSourceTaskItemMapper itemMapper) {
        this.taskMapper = taskMapper;
        this.itemMapper = itemMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        long now = System.currentTimeMillis();
        for (VideoSourceTask task : taskMapper.listRecoverable()) {
            if (List.of("RESOLVING", "RUNNING", "VERIFYING").contains(task.getStatus())) {
                task.setStatus("PAUSED");
                task.setMessage("Application restarted; review and resume");
                task.setUpdatedAt(now);
                taskMapper.updateById(task);
            }
        }
    }

    public List<VideoSourceTask> recoverable() { return taskMapper.listRecoverable(); }
    public VideoSourceTask get(String taskId) { VideoSourceTask task = taskMapper.selectByTaskId(taskId); if (task == null) throw new IllegalArgumentException("Task not found"); return task; }

    public VideoSourceTask create(String type, String provider, Integer total) { return create(type, provider, total, null, null, null, null); }

    public VideoSourceTask create(String type, String provider, Integer total, Long packageId, Long assetId, Long clipId, String planJson) {
        if (!TYPES.contains(type)) throw new IllegalArgumentException("Invalid task type");
        long now = System.currentTimeMillis();
        VideoSourceTask task = new VideoSourceTask();
        task.setTaskId(UUID.randomUUID().toString()); task.setTaskType(type); task.setProvider(provider); task.setStatus("QUEUED");
        task.setPackageId(packageId); task.setVideoAssetId(assetId); task.setClipId(clipId); task.setTotal(total == null ? 0 : Math.max(0, total));
        task.setProcessed(0); task.setSucceeded(0); task.setFailed(0); task.setBytesProcessed(0L); task.setPlanJson(planJson); task.setCreatedAt(now); task.setUpdatedAt(now);
        taskMapper.insert(task); return task;
    }

    public VideoSourceTaskItem addItem(VideoSourceTask task, String key, Long sourceItemId, Long assetId, Long clipId) {
        long now = System.currentTimeMillis(); VideoSourceTaskItem item = new VideoSourceTaskItem(); item.setTaskId(task.getId()); item.setItemKey(key); item.setTaskType(task.getTaskType()); item.setProvider(task.getProvider()); item.setStatus("QUEUED"); item.setSourceItemId(sourceItemId); item.setVideoAssetId(assetId); item.setClipId(clipId); item.setBytesProcessed(0L); item.setAttempts(0); item.setCreatedAt(now); item.setUpdatedAt(now); itemMapper.insert(item); return item;
    }

    @Transactional
    public VideoSourceTask transition(String taskId, String status, String message) {
        if (!STATES.contains(status)) throw new IllegalArgumentException("Invalid task state");
        VideoSourceTask task = get(taskId); if (!canTransition(task.getStatus(), status)) throw new IllegalStateException("Invalid task transition");
        long now = System.currentTimeMillis(); task.setStatus(status); task.setMessage(message); task.setUpdatedAt(now);
        if ("RUNNING".equals(status) && task.getStartedAt() == null) task.setStartedAt(now);
        if (List.of("COMPLETED", "FAILED", "CANCELED").contains(status)) task.setCompletedAt(now); else task.setCompletedAt(null);
        taskMapper.updateById(task); return task;
    }

    public VideoSourceTask pause(String taskId) { return transition(taskId, "PAUSED", "Paused by user"); }
    public VideoSourceTask resume(String taskId) { return transition(taskId, "QUEUED", "Queued for resume"); }
    public VideoSourceTask retry(String taskId) { VideoSourceTask task = get(taskId); if (!List.of("FAILED", "PAUSED").contains(task.getStatus())) throw new IllegalStateException("Only failed or paused task can retry"); task.setStatus("QUEUED"); task.setCompletedAt(null); task.setMessage("Queued for retry"); task.setUpdatedAt(System.currentTimeMillis()); taskMapper.updateById(task); return task; }
    public VideoSourceTask cancel(String taskId) { return transition(taskId, "CANCELED", "Canceled by user"); }

    public void completeItem(long itemId, long bytes) { VideoSourceTaskItem item=itemMapper.selectById(itemId); item.setStatus("COMPLETED"); item.setBytesProcessed(bytes); item.setUpdatedAt(System.currentTimeMillis()); itemMapper.updateById(item); }
    public void failItem(long itemId, String code, String message) { VideoSourceTaskItem item=itemMapper.selectById(itemId); item.setStatus("FAILED"); item.setErrorCode(code); item.setErrorMessage(message); item.setAttempts((item.getAttempts()==null?0:item.getAttempts())+1); item.setLastAttemptAt(System.currentTimeMillis()); item.setUpdatedAt(System.currentTimeMillis()); itemMapper.updateById(item); }
    public List<VideoSourceTaskItem> items(long taskId) { return itemMapper.selectList(new QueryWrapper<VideoSourceTaskItem>().eq("task_id", taskId).orderByAsc("id")); }

    private boolean canTransition(String from, String to) {
        if (from == null) return "QUEUED".equals(to); if (from.equals(to)) return true;
        return switch (from) {
            case "QUEUED" -> List.of("RESOLVING", "RUNNING", "PAUSED", "CANCELED").contains(to);
            case "RESOLVING" -> List.of("RUNNING", "FAILED", "PAUSED", "CANCELED").contains(to);
            case "RUNNING" -> List.of("VERIFYING", "PAUSED", "FAILED", "CANCELED").contains(to);
            case "VERIFYING" -> List.of("COMPLETED", "FAILED", "PAUSED", "CANCELED").contains(to);
            case "PAUSED" -> List.of("QUEUED", "RUNNING", "CANCELED").contains(to);
            default -> false;
        };
    }
}