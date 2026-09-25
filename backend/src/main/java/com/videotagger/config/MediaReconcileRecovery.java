package com.videotagger.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.videotagger.entity.MediaReconcileJobRow;
import com.videotagger.mapper.MediaReconcileJobMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 启动接管：把上次遗留的 {@code RUNNING} 对账任务标成 {@code INTERRUPTED}。
 *
 * <p>和后端重启不能续跑的任务一个道理（参见 {@code ExportTaskRecovery}）：进程没了，
 * 内存里的 <code>handled</code> 集合与执行进度都没了，留着 RUNNING 只会让人以为它还在跑。
 *
 * <p>已经执行完的动作**不会回滚**（关联/删除都是逐条提交的），所以重启后重跑一次即可补齐
 * —— 对账是幂等的：已关联的不再进入未关联集合，已删的更不会。
 */
@Component
public class MediaReconcileRecovery {

    private static final Logger log = LoggerFactory.getLogger(MediaReconcileRecovery.class);

    private final MediaReconcileJobMapper jobMapper;

    public MediaReconcileRecovery(MediaReconcileJobMapper jobMapper) {
        this.jobMapper = jobMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void markInterrupted() {
        List<MediaReconcileJobRow> running = jobMapper.selectList(
                new LambdaQueryWrapper<MediaReconcileJobRow>()
                        .eq(MediaReconcileJobRow::getStatus, "RUNNING"));
        if (running.isEmpty()) {
            return;
        }
        long now = System.currentTimeMillis();
        for (MediaReconcileJobRow row : running) {
            row.setStatus("INTERRUPTED");
            row.setPhase("后端重启中断");
            row.setMessage("进程重启，任务中断；已执行的动作不回滚，再跑一次即可补齐（幂等）");
            row.setFinishedAt(now);
            row.setUpdatedAt(now);
            jobMapper.updateById(row);
        }
        log.warn("对账接管：{} 个 RUNNING 任务标记为 INTERRUPTED", running.size());
    }
}
