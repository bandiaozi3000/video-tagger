package com.videotagger.service;

import com.videotagger.entity.Media;
import com.videotagger.entity.Clip;
import com.videotagger.entity.EmbeddingTask;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaTagMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EmbeddingTaskMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 三层向量生成任务（MEDIA/EPISODE/CLIP）。
 * 打标 / 标签变更只入队（enqueue），不阻塞主链路；生成由 sweep 定时扫描 + 指数退避完成；
 * 应用启动时补做 PENDING/FAILED，覆盖宕机与 API 临时不可用场景。
 */
@Service
public class EmbeddingTaskService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingTaskService.class);
    private static final int MAX_RETRY = 5;

    private final ClipMapper clipMapper;
    private final MediaMapper mediaMapper;
    private final EpisodeMapper episodeMapper;
    private final MediaTagMapper mediaTagMapper;
    private final EpisodeTagMapper episodeTagMapper;
    private final EmbeddingTaskMapper taskMapper;
    private final EmbeddingClient embeddingClient;
    private final VectorStore vectorStore;

    public EmbeddingTaskService(ClipMapper clipMapper, MediaMapper mediaMapper, EpisodeMapper episodeMapper,
                                MediaTagMapper mediaTagMapper, EpisodeTagMapper episodeTagMapper,
                                EmbeddingTaskMapper taskMapper, EmbeddingClient embeddingClient,
                                VectorStore vectorStore) {
        this.clipMapper = clipMapper;
        this.mediaMapper = mediaMapper;
        this.episodeMapper = episodeMapper;
        this.mediaTagMapper = mediaTagMapper;
        this.episodeTagMapper = episodeTagMapper;
        this.taskMapper = taskMapper;
        this.embeddingClient = embeddingClient;
        this.vectorStore = vectorStore;
    }

    /** 入队 / 重置为 PENDING（供打标保存、标签变更触发重嵌入）。异步生成由 sweep 驱动。 */
    public void enqueue(EntityType type, long entityId) {
        long now = System.currentTimeMillis();
        EmbeddingTask task = taskMapper.selectByEntity(type.name(), entityId);
        if (task == null) {
            task = new EmbeddingTask();
            task.setEntityType(type.name());
            task.setEntityId(entityId);
            task.setStatus("PENDING");
            task.setRetryCount(0);
            task.setUpdatedAt(now);
            taskMapper.insert(task);
        } else {
            task.setStatus("PENDING");
            task.setRetryCount(0);
            task.setUpdatedAt(now);
            taskMapper.updateById(task);
        }
    }

    /** 删除任务与向量（删除实体时调用）。 */
    public void deleteFor(EntityType type, long entityId) {
        taskMapper.deleteByEntity(type.name(), entityId);
        vectorStore.delete(type, entityId);
    }

    /** 执行一次嵌入：构建文本 → Embedding API → 写向量 → DONE；失败指数退避重试。 */
    public void process(EntityType type, long entityId) {
        if (!embeddingClient.isConfigured()) {
            return;
        }
        EmbeddingTask task = taskMapper.selectByEntity(type.name(), entityId);
        if (task == null) {
            return;
        }
        String text = buildText(type, entityId);
        try {
            float[] vector = embeddingClient.embed(text);
            vectorStore.upsert(type, entityId, vector);
            task.setStatus("DONE");
        } catch (Exception e) {
            log.warn("{}:{} 向量生成失败：{}", type, entityId, e.getMessage());
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
                process(EntityType.valueOf(task.getEntityType()), task.getEntityId());
            }
        }
    }

    private String buildText(EntityType type, long entityId) {
        return switch (type) {
            case MEDIA -> {
                Media a = mediaMapper.selectById(entityId);
                yield a == null ? null : join(
                        a.getTitle(),
                        a.getAliases(),
                        joinTags(mediaTagMapper.selectTags(entityId)));
            }
            case EPISODE -> {
                Episode ep = episodeMapper.selectById(entityId);
                yield ep == null ? null : join(ep.getTitle(), joinTags(episodeTagMapper.selectTags(entityId)));
            }
            case CLIP -> {
                Clip c = clipMapper.selectById(entityId);
                if (c == null) {
                    yield null;
                }
                String note = c.getNote() == null || c.getNote().isBlank() ? "" : " " + c.getNote();
                yield c.getTag() + note;
            }
        };
    }

    private static String joinTags(List<Tag> tags) {
        return tags.stream().map(Tag::getName).reduce((a, b) -> a + " " + b).orElse("");
    }

    private static String join(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p != null && !p.isBlank()) {
                if (sb.length() > 0) {
                    sb.append(' ');
                }
                sb.append(p.trim());
            }
        }
        return sb.toString();
    }

    @Override
    public void run(ApplicationArguments args) {
        sweep();
    }
}
