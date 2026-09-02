package com.videotagger.metadata;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.MetadataSyncTask;
import com.videotagger.entity.MetadataSyncTaskItem;
import com.videotagger.mapper.MetadataSyncDraftMapper;
import com.videotagger.mapper.MetadataSyncTaskItemMapper;
import com.videotagger.mapper.MetadataSyncTaskMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MetadataSyncWorkspaceServiceTest {

    @Test
    void automaticModeOnlyUpdatesStableIdsAndCreatesUnmatchedItems() {
        MetadataSyncDraftMapper draftMapper = mock(MetadataSyncDraftMapper.class);
        MetadataSyncTaskMapper taskMapper = mock(MetadataSyncTaskMapper.class);
        MetadataSyncTaskItemMapper itemMapper = mock(MetadataSyncTaskItemMapper.class);
        MetadataSyncTaskExecutor executor = mock(MetadataSyncTaskExecutor.class);
        ObjectMapper objectMapper = new ObjectMapper();
        List<MetadataSyncTaskItem> storedItems = new ArrayList<>();
        AtomicLong itemIds = new AtomicLong(1);
        doAnswer(invocation -> {
            MetadataSyncTask task = invocation.getArgument(0);
            task.setId(100L);
            return 1;
        }).when(taskMapper).insert(any(MetadataSyncTask.class));
        doAnswer(invocation -> {
            MetadataSyncTaskItem item = invocation.getArgument(0);
            item.setId(itemIds.getAndIncrement());
            storedItems.add(item);
            return 1;
        }).when(itemMapper).insert(any(MetadataSyncTaskItem.class));
        when(itemMapper.listByTask(100L)).thenReturn(storedItems);

        MetadataSyncWorkspaceService service = new MetadataSyncWorkspaceService(
                draftMapper, taskMapper, itemMapper, executor, objectMapper);
        MetadataSyncTaskCreateRequest request = new MetadataSyncTaskCreateRequest(
                "BANGUMI", "YEAR", objectMapper.createObjectNode(), true, List.of(
                item("1", "EXTERNAL_ID", 9L),
                item("2", "NONE", null),
                item("3", "TITLE", 8L)
        ));

        MetadataSyncTaskDetail detail = service.createTask(request);

        assertEquals("UPDATE", detail.items().get(0).getAction());
        assertEquals("QUEUED", detail.items().get(0).getStatus());
        assertEquals("CREATE", detail.items().get(1).getAction());
        assertEquals("PENDING_REVIEW", detail.items().get(2).getStatus());
        assertEquals(2, detail.task().getSelectedTotal());
        assertEquals(1, detail.task().getPendingReview());
        verify(executor).runAsync(100L);
    }

    private static MetadataSyncTaskCreateRequest.Item item(String externalId, String matchType, Long mediaId) {
        return new MetadataSyncTaskCreateRequest.Item(externalId, "作品 " + externalId, null,
                null, mediaId, matchType, null);
    }
}