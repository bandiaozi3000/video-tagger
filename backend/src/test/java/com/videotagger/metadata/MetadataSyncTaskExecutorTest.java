package com.videotagger.metadata;

import com.videotagger.entity.MetadataSyncTask;
import com.videotagger.entity.MetadataSyncTaskItem;
import com.videotagger.mapper.MetadataSyncTaskItemMapper;
import com.videotagger.mapper.MetadataSyncTaskMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MetadataSyncTaskExecutorTest {

    @Test
    void itemFailureDoesNotStopRemainingTaskAccounting() {
        MetadataSyncTaskMapper taskMapper = mock(MetadataSyncTaskMapper.class);
        MetadataSyncTaskItemMapper itemMapper = mock(MetadataSyncTaskItemMapper.class);
        MetadataSyncService syncService = mock(MetadataSyncService.class);
        MetadataSyncTask task = task(10L);
        MetadataSyncTaskItem succeeded = item(1L, 10L, "101");
        MetadataSyncTaskItem failed = item(2L, 10L, "102");
        List<MetadataSyncTaskItem> items = List.of(succeeded, failed);
        when(taskMapper.selectById(10L)).thenReturn(task);
        when(itemMapper.listByTask(10L)).thenReturn(items);
        when(syncService.syncOne("101", "CREATE", null))
                .thenReturn(new MetadataSyncResult(1, 1, 0, 0, List.of()));
        when(syncService.syncOne("102", "CREATE", null))
                .thenThrow(new MetadataProviderException("upstream failed", 502));

        new MetadataSyncTaskExecutor(taskMapper, itemMapper, syncService).run(10L);

        assertEquals("SUCCEEDED", succeeded.getStatus());
        assertEquals("FAILED", failed.getStatus());
        assertEquals("PARTIAL", task.getStatus());
        assertEquals(2, task.getProcessed());
        assertEquals(1, task.getSucceeded());
        assertEquals(1, task.getFailed());
        verify(syncService).syncOne("101", "CREATE", null);
        verify(syncService).syncOne("102", "CREATE", null);
    }

    private static MetadataSyncTask task(long id) {
        MetadataSyncTask task = new MetadataSyncTask();
        task.setId(id);
        task.setStatus("QUEUED");
        task.setStage("QUEUED");
        return task;
    }

    private static MetadataSyncTaskItem item(long id, long taskId, String externalId) {
        MetadataSyncTaskItem item = new MetadataSyncTaskItem();
        item.setId(id);
        item.setTaskId(taskId);
        item.setExternalId(externalId);
        item.setAction("CREATE");
        item.setStatus("QUEUED");
        item.setStage("QUEUED");
        item.setAttempts(0);
        return item;
    }
}