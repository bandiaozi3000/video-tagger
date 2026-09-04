package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.VideoAsset;
import com.videotagger.entity.VideoSourceTask;
import com.videotagger.entity.VideoSourceTaskItem;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.videosource.torrent.TorrentClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.concurrent.Executor;

@Service
public class VideoSourceTaskExecutor {
    public record DownloadPlan(long assetId, long mediaId, long entryId, long episodeId, String locator, long maxBytes, Integer targetEpisode) {}
    private final VideoSourceTaskService tasks; private final VideoDownloadService downloads; private final TorrentEpisodeDownloadService torrents; private final VideoAssetMapper assetMapper; private final ObjectMapper objectMapper; private final Executor executor;
    public VideoSourceTaskExecutor(VideoSourceTaskService tasks, VideoDownloadService downloads, TorrentEpisodeDownloadService torrents, VideoAssetMapper assetMapper, ObjectMapper objectMapper, @Qualifier("videoSourceExecutor") Executor executor) { this.tasks=tasks; this.downloads=downloads; this.torrents=torrents; this.assetMapper=assetMapper; this.objectMapper=objectMapper; this.executor=executor; }

    public VideoSourceTask queueDownload(DownloadPlan plan) {
        try {
            VideoSourceTask task=tasks.create("DOWNLOAD_EPISODE",null,1,null,plan.assetId(),null,objectMapper.writeValueAsString(plan));
            VideoSourceTaskItem item=tasks.addItem(task,"asset-"+plan.assetId(),null,plan.assetId(),null);
            executor.execute(() -> execute(task.getTaskId(), item.getId(), plan)); return task;
        } catch (Exception e) { throw new IllegalArgumentException("Cannot create download task", e); }
    }
    public VideoSourceTask resume(String taskId) { VideoSourceTask task=tasks.retry(taskId); try { DownloadPlan plan=objectMapper.readValue(task.getPlanJson(),DownloadPlan.class); VideoSourceTaskItem item=tasks.items(task.getId()).stream().findFirst().orElseGet(() -> tasks.addItem(task,"asset-"+plan.assetId(),null,plan.assetId(),null)); executor.execute(() -> execute(taskId,item.getId(),plan)); return task; } catch(Exception e){ throw new IllegalArgumentException("Invalid task plan",e); } }
    private void execute(String taskId,long itemId,DownloadPlan plan) { try { if("CANCELED".equals(tasks.get(taskId).getStatus()))return; tasks.transition(taskId,"RESOLVING","Validating remote source"); tasks.transition(taskId,"RUNNING","Downloading"); var result = TorrentClient.isTorrentLocator(plan.locator()) ? torrents.download(plan.assetId(),plan.mediaId(),plan.entryId(),plan.episodeId(),plan.locator(),plan.maxBytes(),plan.targetEpisode()) : downloads.download(plan.assetId(),plan.mediaId(),plan.entryId(),plan.episodeId(),plan.locator(),plan.maxBytes()); tasks.transition(taskId,"VERIFYING","Verifying downloaded asset"); tasks.completeItem(itemId,result.bytes()); VideoSourceTask task=tasks.get(taskId); task.setProcessed(1);task.setSucceeded(1);task.setBytesProcessed(result.bytes()); tasks.transition(taskId,"COMPLETED","Download completed"); } catch(Exception e){ failAsset(plan, e); tasks.failItem(itemId,"DOWNLOAD_FAILED",e.getMessage()); try{tasks.transition(taskId,"FAILED",e.getMessage());}catch(Exception ignored){} } }
    private void failAsset(VideoSourceTaskExecutor.DownloadPlan plan, Exception e){
        if (plan == null || assetMapper == null) return;
        try {
            VideoAsset asset = assetMapper.selectById(plan.assetId());
            if (asset == null) return;
            String msg = e.getMessage();
            if (msg != null && msg.length() > 500) msg = msg.substring(0, 500);
            asset.setFailureReason(msg == null || msg.isBlank() ? "Download failed" : msg);
            asset.setAvailabilityState("FAILED");
            asset.setUpdatedAt(System.currentTimeMillis());
            assetMapper.updateById(asset);
        } catch (Exception ignored) {
        }
    }
}