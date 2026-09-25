package com.videotagger.reconcile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.videotagger.entity.MediaReconcileJobRow;
import com.videotagger.mapper.MediaReconcileJobMapper;
import com.videotagger.mapper.MediaReconcileMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 媒体库对账任务：持久化任务行 + {@code @Async("mediaBatchExecutor")} 分批跑。
 *
 * <p><b>为什么必须持久化</b>：全量对账要打上千次 Bangumi 搜索、可能物理删几千条 media，
 * 跑几十分钟到几小时；只在内存里的话后端一重启就「看不见了」。
 *
 * <p><b>取消语义</b>：和同步一样，**只在批次边界停**，不掐断正在飞的写请求。
 *
 * <p><b>⚠️ 分页的坑（本类最容易被写错的地方）</b>：live 模式下 media 会被关联走或被删掉，
 * 用 {@code OFFSET} 翻页会**跳行**（第 2 页的偏移量建立在一个已经变短的集合上）。
 * 所以这里**每轮都取前 N 条**（offset 恒为 0），另用内存 {@link Set} 记住已处理的 mediaId；
 * 连「跳过」的也要记进去，否则它们永远留在未关联集合里 → 死循环。
 */
@Service
public class MediaReconcileJobService {

    private static final Logger log = LoggerFactory.getLogger(MediaReconcileJobService.class);

    /** live 模式必须原样带上的确认词（前端要用户手输）。 */
    public static final String CONFIRM_TOKEN = "DELETE";

    /** 每批盘点条数：太小则进度写库太频，太大则取消响应慢。 */
    private static final int BATCH = 200;

    private final MediaReconcileJobMapper jobMapper;
    private final MediaReconcileMapper reconcileMapper;
    private final MediaReconcilePlanner planner;
    private final MediaReconcileExecutor executor;

    public MediaReconcileJobService(MediaReconcileJobMapper jobMapper, MediaReconcileMapper reconcileMapper,
                                    MediaReconcilePlanner planner, MediaReconcileExecutor executor) {
        this.jobMapper = jobMapper;
        this.reconcileMapper = reconcileMapper;
        this.planner = planner;
        this.executor = executor;
    }

    /** 建任务（只写任务行，不执行）。live 的前置校验都在这儿。 */
    public MediaReconcileJobRow create(String mode, String confirmToken) {
        String normalized = mode == null ? "" : mode.trim().toLowerCase();
        // ⚠️ 这个判断曾经写反过（live 时恒抛 400），下面这种写法才等价于「只接受 dry / live」
        boolean dryRun = !"live".equals(normalized);
        if (dryRun && !"dry".equals(normalized)) {
            throw new IllegalArgumentException("mode 只能是 dry 或 live");
        }
        if (!dryRun) {
            if (!CONFIRM_TOKEN.equals(confirmToken)) {
                throw new IllegalArgumentException("live 模式需要确认词 " + CONFIRM_TOKEN);
            }
            // 「先干跑、后执行」：必须存在一条**比最近一次 live 更新**的 DONE dry。
            // ⚠️ 曾经写成「只要历史上有过 DONE 的 dry 就放行」→ 那条干跑会**永久免检**后续所有
            // live，与你想要的「每次执行前先看一遍新报告」不符（2026-09-25 用户指出）。
            long lastLiveId = lastJobId("live");
            Long freshDry = jobMapper.selectCount(new LambdaQueryWrapper<MediaReconcileJobRow>()
                    .eq(MediaReconcileJobRow::getMode, "dry")
                    .eq(MediaReconcileJobRow::getStatus, "DONE")
                    .gt(MediaReconcileJobRow::getId, lastLiveId));
            if (freshDry == null || freshDry == 0) {
                throw new IllegalArgumentException("请先跑一次新的 dry（干跑）再执行 live");
            }
        }
        Long running = jobMapper.selectCount(new LambdaQueryWrapper<MediaReconcileJobRow>()
                .eq(MediaReconcileJobRow::getStatus, "RUNNING"));
        if (running != null && running > 0) {
            throw new IllegalArgumentException("已有对账任务在跑，请等它结束或先取消");
        }
        long now = System.currentTimeMillis();
        MediaReconcileJobRow row = new MediaReconcileJobRow();
        row.setMode(dryRun ? "dry" : "live");
        row.setStatus("PENDING");
        row.setPhase("排队中");
        row.setTotal(reconcileMapper.countUnlinked());
        row.setDone(0);
        row.setLinked(0);
        row.setMerged(0);
        row.setPurged(0);
        row.setSkipped(0);
        row.setFailed(0);
        row.setCoverDeleted(0);
        row.setEntryCleaned(0);
        row.setConfirmToken(dryRun ? null : confirmToken);
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        jobMapper.insert(row);
        return row;
    }

    /** 后台执行。**必须由外部（controller）调用**，自调用会让 @Async 失效。 */
    @Async("mediaBatchExecutor")
    public void execute(long jobId) {
        MediaReconcileJobRow job = jobMapper.selectById(jobId);
        if (job == null || !"PENDING".equals(job.getStatus())) {
            return;
        }
        boolean dryRun = !"live".equals(job.getMode());
        long now = System.currentTimeMillis();
        job.setStatus("RUNNING");
        job.setPhase("盘点中");
        job.setStartedAt(now);
        job.setUpdatedAt(now);
        jobMapper.updateById(job);

        Set<Long> handled = new LinkedHashSet<>();
        List<Map<String, Object>> detail = new ArrayList<>();
        boolean cancelled = false;
        long cursor = 0;
        int scannedTotal = 0;
        try {
            while (true) {
                // 取消检查放在**批次边界**：当前这一批跑完才停
                MediaReconcileJobRow fresh = jobMapper.selectById(jobId);
                if (fresh != null && "CANCELLED".equals(fresh.getStatus())) {
                    cancelled = true;
                    break;
                }
                MediaReconcilePlanner.PlanResult plan = planner.plan(BATCH, cursor);
                if (plan.scanned() == 0) {
                    break;
                }
                cursor = plan.lastId();   // id 游标向前推进（对增删都稳定）
                for (ReconcileDecision decision : plan.decisions()) {
                    handled.add(decision.mediaId());
                    MediaReconcileExecutor.ExecResult r = executor.execute(decision, dryRun);
                    bump(job, decision, r, dryRun);
                    if (decision.action() != ReconcileAction.PURGE || decision.hasRefs() || decision.hasEdits()) {
                        // 「无引用无痕迹」那 3464 条不存明细（纯噪音）；有引用的删除要能事后回看
                        detail.add(toDetail(decision, r));
                    }
                }
                scannedTotal += plan.scanned();
                job.setDone(scannedTotal);
                saveProgress(jobId, job, job.getPhase());
            }

            if (cancelled) {
                // 已在本轮循环里看到 CANCELLED（晚到的取消在下面收尾处再读一次 DB）
                job.setPhase("已取消");
            } else {
                saveProgress(jobId, job, "收尾清理");   // 同样不碰 status（窗口再小也别留）
                if (!dryRun) {
                    job.setCoverDeleted(executor.deleteCoversOfLinked(false));
                } else {
                    job.setCoverDeleted(executor.deleteCoversOfLinked(true));
                }
                job.setEntryCleaned(executor.cleanOrphanMediaEntries(dryRun));
            }
            job.setDetailJson(composeDetail(detail));
            // 收尾：**再读一次 DB 状态** —— 晚到的取消也要认。
            // （循环里写进度用的是 saveProgress，**不碰 status**，所以这里读到的一定是真实意图）
            MediaReconcileJobRow latest = jobMapper.selectById(jobId);
            boolean stop = cancelled || (latest != null && "CANCELLED".equals(latest.getStatus()));
            job.setStatus(stop ? "CANCELLED" : "DONE");
            job.setPhase(stop ? "已取消" : "完成");
            job.setMessage(summary(job, dryRun, stop));
        } catch (Exception e) {
            log.error("对账任务 {} 失败", jobId, e);
            job.setStatus("FAILED");
            job.setPhase("失败");
            job.setMessage(String.valueOf(e.getMessage()));
        } finally {
            job.setFinishedAt(System.currentTimeMillis());
            job.setUpdatedAt(System.currentTimeMillis());
            jobMapper.updateById(job);
        }
    }

    /** 取消：只改状态，执行循环会在**批次边界**看到并停下（绝不掐断在飞的写请求）。 */
    public MediaReconcileJobRow cancel(long jobId) {
        MediaReconcileJobRow job = jobMapper.selectById(jobId);
        if (job == null) {
            throw new java.util.NoSuchElementException("任务不存在: " + jobId);
        }
        if ("RUNNING".equals(job.getStatus()) || "PENDING".equals(job.getStatus())) {
            job.setStatus("CANCELLED");
            job.setPhase("取消中（当前批跑完即停）");
            job.setUpdatedAt(System.currentTimeMillis());
            jobMapper.updateById(job);
        }
        return job;
    }

    /**
     * 写进度：**只更新进度字段，绝不碰 `status`**。
     *
     * <p>⚠️ 这里本来用 `updateById(job)`，而 MyBatis-Plus 会把内存行里非空的字段全部写回 ——
     * 包括 `status=RUNNING`，于是**把用户刚设的 `CANCELLED` 覆盖掉**，取消随机失效。
     * 上次实测“取消能停”只是运气好（取消了落在两次覆写之间的窗口里）；
     * 2026-09-25 在全量同步上复现：取消 2026 全年，一路跑到 4/4 段才 DONE。
     */
    private void saveProgress(long jobId, MediaReconcileJobRow job, String phase) {
        job.setUpdatedAt(System.currentTimeMillis());
        jobMapper.update(null, new LambdaUpdateWrapper<MediaReconcileJobRow>()
                .eq(MediaReconcileJobRow::getId, jobId)
                .set(MediaReconcileJobRow::getPhase, phase)
                .set(MediaReconcileJobRow::getDone, job.getDone())
                .set(MediaReconcileJobRow::getLinked, job.getLinked())
                .set(MediaReconcileJobRow::getMerged, job.getMerged())
                .set(MediaReconcileJobRow::getPurged, job.getPurged())
                .set(MediaReconcileJobRow::getSkipped, job.getSkipped())
                .set(MediaReconcileJobRow::getFailed, job.getFailed())
                .set(MediaReconcileJobRow::getUpdatedAt, job.getUpdatedAt()));
    }

    /** 某个 mode 下最新的任务 id（没有则 0）—— 给「必须先干跑」的前置条件用。 */
    private long lastJobId(String mode) {
        List<MediaReconcileJobRow> rows = jobMapper.selectList(new LambdaQueryWrapper<MediaReconcileJobRow>()
                .eq(MediaReconcileJobRow::getMode, mode)
                .orderByDesc(MediaReconcileJobRow::getId)
                .last("LIMIT 1"));
        return rows.isEmpty() ? 0L : rows.get(0).getId();
    }

    public MediaReconcileJobRow latest() {        List<MediaReconcileJobRow> rows = jobMapper.selectList(new LambdaQueryWrapper<MediaReconcileJobRow>()
                .orderByDesc(MediaReconcileJobRow::getId).last("LIMIT 1"));
        return rows.isEmpty() ? null : rows.get(0);
    }

    public MediaReconcileJobRow get(long jobId) {
        MediaReconcileJobRow row = jobMapper.selectById(jobId);
        if (row == null) {
            throw new java.util.NoSuchElementException("任务不存在: " + jobId);
        }
        return row;
    }

    /**
     * @param dryRun 干跑时**不能**把 skipped/failed 也加上：AUTO 在干跑下 applied 恒为 false
     *               （只报告不写），否则会把「将要关联」错记成「跳过」。
     */
    private void bump(MediaReconcileJobRow job, ReconcileDecision d, MediaReconcileExecutor.ExecResult r,
                      boolean dryRun) {
        if (d.action() == ReconcileAction.PURGE) {
            // 干跑时 applied 恒为 false，所以不能拿它当条件；PURGE 一律计入 purged
            job.setPurged(job.getPurged() + 1);
            if (!dryRun && !r.applied() && r.reason() != null && r.reason().contains("失败")) {
                job.setFailed(job.getFailed() + 1);
            }
            return;
        }
        if (!dryRun && !r.applied()) {
            job.setSkipped(job.getSkipped() + 1);
            if (r.reason() != null && r.reason().contains("失败")) {
                job.setFailed(job.getFailed() + 1);
            }
        }
        if (d.linkedMediaId() == null) {
            job.setLinked(job.getLinked() + 1);
        } else {
            job.setMerged(job.getMerged() + 1);
        }
    }

    private Map<String, Object> toDetail(ReconcileDecision d, MediaReconcileExecutor.ExecResult r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mediaId", d.mediaId());
        m.put("title", d.title());
        m.put("action", d.action().name());
        m.put("matched", d.matchedTitle());
        m.put("via", d.via());
        m.put("score", d.score());
        m.put("applied", r.applied());
        m.put("reason", r.reason());
        if (!r.overwritten().isEmpty()) {
            m.put("overwritten", r.overwritten());
        }
        return m;
    }

    private String composeDetail(List<Map<String, Object>> detail) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(detail);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String summary(MediaReconcileJobRow job, boolean dryRun, boolean cancelled) {
        return (dryRun ? "[干跑] " : "[执行] ")
                + (cancelled ? "已取消；" : "完成；")
                + "扫描 " + job.getDone()
                + "，新建关联 " + job.getLinked()
                + "，合并 " + job.getMerged()
                + (dryRun ? "" : "，物理删 " + job.getPurged())
                + "，跳过 " + job.getSkipped()
                + "，失败 " + job.getFailed()
                + "，封面清理 " + job.getCoverDeleted()
                + "，孤儿 media_entry " + job.getEntryCleaned();
    }
}
