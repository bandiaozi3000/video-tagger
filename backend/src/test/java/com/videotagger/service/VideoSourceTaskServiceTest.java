package com.videotagger.service;

import com.videotagger.entity.VideoSourceTask;
import com.videotagger.mapper.VideoSourceTaskItemMapper;
import com.videotagger.mapper.VideoSourceTaskMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VideoSourceTaskServiceTest {
 @Test void restartPausesInFlightTask(){VideoSourceTaskMapper mapper=mock(VideoSourceTaskMapper.class);VideoSourceTaskItemMapper items=mock(VideoSourceTaskItemMapper.class);VideoSourceTask task=new VideoSourceTask();task.setId(1L);task.setStatus("RUNNING");when(mapper.listRecoverable()).thenReturn(List.of(task));VideoSourceTaskService service=new VideoSourceTaskService(mapper,items);service.run(null);assertEquals("PAUSED",task.getStatus());verify(mapper).updateById(task);}
 @Test void failedTaskCanRetry(){VideoSourceTaskMapper mapper=mock(VideoSourceTaskMapper.class);VideoSourceTaskItemMapper items=mock(VideoSourceTaskItemMapper.class);VideoSourceTask task=new VideoSourceTask();task.setTaskId("t");task.setStatus("FAILED");when(mapper.selectByTaskId("t")).thenReturn(task);VideoSourceTaskService service=new VideoSourceTaskService(mapper,items);assertEquals("QUEUED",service.retry("t").getStatus());}
}