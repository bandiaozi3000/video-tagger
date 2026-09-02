package com.videotagger.metadata;

import com.videotagger.entity.MetadataSyncTask;
import com.videotagger.mapper.MetadataSyncTaskItemMapper;
import com.videotagger.mapper.MetadataSyncTaskMapper;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class MetadataSyncTaskRecovery implements ApplicationRunner {
    private final MetadataSyncTaskMapper taskMapper;
    private final MetadataSyncTaskItemMapper itemMapper;
    private final MetadataSyncTaskExecutor executor;

    public MetadataSyncTaskRecovery(MetadataSyncTaskMapper taskMapper, MetadataSyncTaskItemMapper itemMapper,
                                    MetadataSyncTaskExecutor executor) {
        this.taskMapper = taskMapper;
        this.itemMapper = itemMapper;
        this.executor = executor;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (MetadataSyncTask task : taskMapper.listRecoverable()) {
            itemMapper.resetRunning(task.getId(), System.currentTimeMillis());
            task.setStatus("QUEUED");
            task.setStage("QUEUED");
            task.setCompletedAt(null);
            task.setUpdatedAt(System.currentTimeMillis());
            taskMapper.updateById(task);
            executor.runAsync(task.getId());
        }
    }
}