package com.videotagger.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.videotagger.entity.MediaFullSyncJobRow;
import com.videotagger.mapper.MediaFullSyncJobMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 启动接管：把上次遗留的 {@code RUNNING} 全量同步任务标成 {@code INTERRUPTED}。
 *
 * <p>与对账同理（{@code MediaReconcileRecovery} / {@code ExportTaskRecovery}）：进程没了，
 * 内存里的已处理集合与进度都没了，留着 RUNNING 只会让人以为它还在跑。
 * 已完成的部分**不回滚**，再跑一次即可补齐 —— 同步是幂等的（走 UPDATE/LINK 而不是重复新增）。
 */
@Component
public class MediaFullSyncRecovery {

    private static final Logger log = LoggerFactory.getLogger(MediaFullSyncRecovery.class);

    private final MediaFullSyncJobMapper jobMapper;

    public MediaFullSyncRecovery(MediaFullSyncJobMapper jobMapper) {
        this.jobMapper = jobMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void markInterrupted() {
        List<MediaFullSyncJobRow> running = jobMapper.selectList(
                new LambdaQueryWrapper<MediaFullSyncJobRow>().eq(MediaFullSyncJobRow::getStatus, "RUNNING"));
        if (running.isEmpty()) {
            return;
        }
        long now = System.currentTimeMillis();
        for (MediaFullSyncJobRow row : running) {
            row.setStatus("INTERRUPTED");
            row.setPhase("后端重启中断");
            row.setMessage("进程重启，任务中断；已同步的不回滚，再跑一次即可补齐（幂等）");
            row.setFinishedAt(now);
            row.setUpdatedAt(now);
            jobMapper.updateById(row);
        }
        log.warn("全量同步接管：{} 个 RUNNING 任务标记为 INTERRUPTED", running.size());
    }
}
