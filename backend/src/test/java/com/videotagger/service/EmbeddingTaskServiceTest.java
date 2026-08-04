package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.EmbeddingTask;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaTagMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EmbeddingTaskMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class EmbeddingTaskServiceTest {

    ClipMapper clipMapper;
    EmbeddingTaskMapper taskMapper;
    EmbeddingClient embeddingClient;
    VectorStore vectorStore;
    EmbeddingTaskService service;

    @BeforeEach
    void setUp() {
        clipMapper = mock(ClipMapper.class);
        taskMapper = mock(EmbeddingTaskMapper.class);
        embeddingClient = mock(EmbeddingClient.class);
        vectorStore = mock(VectorStore.class);
        service = new EmbeddingTaskService(clipMapper, mock(MediaMapper.class), mock(EpisodeMapper.class),
                mock(MediaTagMapper.class), mock(EpisodeTagMapper.class),
                taskMapper, embeddingClient, vectorStore);
    }

    private Clip clip(long id) {
        Clip c = new Clip();
        c.setId(id);
        c.setTag("高燃战斗");
        c.setNote("主角觉醒");
        return c;
    }

    private EmbeddingTask pendingTask(long entityId, int retryCount, long updatedAt) {
        EmbeddingTask t = new EmbeddingTask();
        t.setEntityType("CLIP");
        t.setEntityId(entityId);
        t.setStatus("PENDING");
        t.setRetryCount(retryCount);
        t.setUpdatedAt(updatedAt);
        return t;
    }

    @Test
    void processSkipsWhenNotConfigured() {
        when(embeddingClient.isConfigured()).thenReturn(false);

        service.process(EntityType.CLIP, 1L);

        verifyNoInteractions(vectorStore);
        verify(taskMapper, never()).updateById(any(EmbeddingTask.class));
    }

    @Test
    void processSuccessUpsertsAndMarksDone() {
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed("高燃战斗 主角觉醒")).thenReturn(new float[]{0.1f});
        when(clipMapper.selectById(1L)).thenReturn(clip(1L));
        EmbeddingTask task = pendingTask(1L, 0, System.currentTimeMillis());
        when(taskMapper.selectByEntity("CLIP", 1L)).thenReturn(task);

        service.process(EntityType.CLIP, 1L);

        verify(vectorStore).upsert(eq(EntityType.CLIP), eq(1L), any(float[].class));
        assertEquals("DONE", task.getStatus());
        verify(taskMapper).updateById(task);
    }

    @Test
    void processFailureIncrementsRetry() {
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed(anyString())).thenThrow(new RuntimeException("API 超时"));
        when(clipMapper.selectById(1L)).thenReturn(clip(1L));
        EmbeddingTask task = pendingTask(1L, 1, System.currentTimeMillis());
        when(taskMapper.selectByEntity("CLIP", 1L)).thenReturn(task);

        service.process(EntityType.CLIP, 1L);

        assertEquals(2, task.getRetryCount());
        assertEquals("PENDING", task.getStatus());
    }

    @Test
    void processFailureAtRetry4MarksFailed() {
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed(anyString())).thenThrow(new RuntimeException("API 超时"));
        when(clipMapper.selectById(1L)).thenReturn(clip(1L));
        EmbeddingTask task = pendingTask(1L, 4, System.currentTimeMillis());
        when(taskMapper.selectByEntity("CLIP", 1L)).thenReturn(task);

        service.process(EntityType.CLIP, 1L);

        assertEquals(5, task.getRetryCount());
        assertEquals("FAILED", task.getStatus());
    }

    @Test
    void sweepOnlyProcessesDueTasks() {
        long now = System.currentTimeMillis();
        EmbeddingTask due = pendingTask(1L, 1, now - 5_000);    // 退避 2^1*1000=2s，已到期
        EmbeddingTask notDue = pendingTask(2L, 3, now - 5_000); // 退避 2^3*1000=8s，未到期
        when(taskMapper.selectPending()).thenReturn(List.of(due, notDue));
        when(embeddingClient.isConfigured()).thenReturn(true); // process 推进到 selectByEntity 后因 task/clip 为 null 早退

        service.sweep();

        verify(taskMapper).selectByEntity("CLIP", 1L);
        verify(taskMapper, never()).selectByEntity("CLIP", 2L);
    }
}
