package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.EmbeddingTask;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EmbeddingTaskMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmbeddingTaskService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingTaskService.class);
    private static final int MAX_RETRY = 5;

    private final ClipMapper clipMapper;
    private final EmbeddingTaskMapper taskMapper;
    private final EmbeddingClient embeddingClient;
    private final VectorStore vectorStore;

    public EmbeddingTaskService(ClipMapper clipMapper, EmbeddingTaskMapper taskMapper,
                                EmbeddingClient embeddingClient, VectorStore vectorStore) {
        this.clipMapper = clipMapper;
        this.taskMapper = taskMapper;
        this.embeddingClient = embeddingClient;
        this.vectorStore = vectorStore;
    }

    @Async("embeddingExecutor")
    public void processAsync(long clipId) {
        process(clipId);
    }

    public void process(long clipId) {
        if (!embeddingClient.isConfigured()) {
            return;
        }
        Clip clip = clipMapper.selectById(clipId);
        EmbeddingTask task = taskMapper.selectById(clipId);
        if (clip == null || task == null) {
            return;
        }
        String text = clip.getTag() + (clip.getNote() == null || clip.getNote().isBlank()
                ? "" : " " + clip.getNote());
        try {
            float[] vector = embeddingClient.embed(text);
            vectorStore.upsert(clipId, vector);
            task.setStatus("DONE");
        } catch (Exception e) {
            log.warn("clip {} 向量生成失败：{}", clipId, e.getMessage());
            task.setRetryCount(task.getRetryCount() + 1);
            task.setStatus(task.getRetryCount() >= MAX_RETRY ? "FAILED" : "PENDING");
        }
        task.setUpdatedAt(System.currentTimeMillis());
        taskMapper.updateById(task);
    }

    /** 每 60 秒扫描一次待补任务，按 2^retry 秒指数退避 */
    @Scheduled(fixedDelay = 60_000)
    public void sweep() {
        List<EmbeddingTask> pending;
        try {
            pending = taskMapper.selectPending();
        } catch (Exception e) {
            log.warn("扫描待补向量任务失败：{}", e.getMessage());
            return;
        }
        long now = System.currentTimeMillis();
        for (EmbeddingTask task : pending) {
            long backoffMs = (1L << task.getRetryCount()) * 1_000L;
            if (task.getUpdatedAt() + backoffMs <= now) {
                process(task.getClipId());
            }
        }
    }

    @Override
    public void run(ApplicationArguments args) {
        sweep();
    }
}
