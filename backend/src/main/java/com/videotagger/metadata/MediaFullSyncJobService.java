package com.videotagger.metadata;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.videotagger.entity.MediaFullSyncJobRow;
import com.videotagger.mapper.MediaFullSyncJobMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

/**
 * 「全量同步」任务：按弹窗里选好的筛选条件，**跳过"拉取候选"这一步**，直接把符合条件的番剧全部同步进来。
 *
 * <p><b>同步逻辑与弹窗逐条勾选完全同源</b> —— 同一个 {@link SyncActionDecider}（EXTERNAL_ID→UPDATE /
 * TITLE→LINK / NONE→CREATE / 命中多个→SKIP）+ 同一个 {@link MetadataSyncCommitService#commit}，
 * 只是不渲染那 400 行列表。所以它**天然幂等**：第二次跑走 UPDATE/LINK，不会重复新增。
 *
 * <p><b>为什么要后台</b>：实测 13 年 ≈ 52 段、约 1.4 万条，每条 commit 要拉 subject+集+关联 ≈ 3 次请求
 * → 2–4 小时。挂在 HTTP 请求里不可能，所以任务行持久化（V41）+ 前端轮询进度。
 *
 * <p><b>取消语义与对账一致</b>：只在**批次边界**停，不掐断正在飞的写请求。
 */
@Service
public class MediaFullSyncJobService {

    private static final Logger log = LoggerFactory.getLogger(MediaFullSyncJobService.class);

    /** 每批提交多少条（与弹窗的 12 同量级；每条后端要打 3 次 Bangumi，批大没收益）。 */
    private static final int COMMIT_BATCH = 20;

    private final MediaFullSyncJobMapper jobMapper;
    private final MetadataSyncService syncService;
    private final MetadataSyncCommitService commitService;

    public MediaFullSyncJobService(MediaFullSyncJobMapper jobMapper, MetadataSyncService syncService,
                                   MetadataSyncCommitService commitService) {
        this.jobMapper = jobMapper;
        this.syncService = syncService;
        this.commitService = commitService;
    }

    /** 筛选条件（与弹窗「选范围」一一对应）。 */
    public record StartRequest(List<Integer> years, List<String> seasons, List<Integer> months,
                               String region, String category) {
    }

    /** 建任务：校验条件 + 规划区间 + 写任务行（不执行）。 */
    public MediaFullSyncJobRow create(StartRequest request) {
        StartRequest safe = request == null ? new StartRequest(null, null, null, null, null) : request;
        List<Integer> years = safe.years() == null ? List.of() : safe.years();
        if (years.isEmpty()) {
            throw new IllegalArgumentException("请至少选择一个年份");
        }
        Long running = jobMapper.selectCount(new LambdaQueryWrapper<MediaFullSyncJobRow>()
                .eq(MediaFullSyncJobRow::getStatus, "RUNNING"));
        if (running != null && running > 0) {
            throw new IllegalArgumentException("已有全量同步在跑，请等它结束或先取消");
        }
        List<SyncRange> ranges = SyncRangePlanner.plan(years, safe.seasons(), safe.months());
        long now = System.currentTimeMillis();
        MediaFullSyncJobRow row = new MediaFullSyncJobRow();
        row.setStatus("PENDING");
        row.setPhase("排队中");
        row.setYearsJson(toJson(years));
        row.setSeasonsJson(toJson(safe.seasons()));
        row.setMonthsJson(toJson(safe.months()));
        row.setRegion(safe.region());
        row.setCategory(safe.category());
        row.setTotalRanges(ranges.size());
        // **断点续跑**：同条件的上一次如果没跑完（INTERRUPTED / CANCELLED / FAILED），
        // 就从它已完成的段数继续。理由：`done_ranges` 只在**整段跑完**时才 +1，
        // 而段的顺序由 SyncRangePlanner 按条件确定 —— 所以「前 k 段已完成」是精确的。
        // 注意 **DONE 不复用**：跑完过还想再跑 = 想拿 Bangumi 的新增，不能跳过任何段。
        int resumeFrom = resumeOffset(row);
        row.setDoneRanges(Math.min(resumeFrom, ranges.size()));
        row.setDoneItems(0);
        row.setAdded(0);
        row.setUpdated(0);
        row.setSkipped(0);
        row.setFailed(0);
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        jobMapper.insert(row);
        return row;
    }

    /** 后台执行。**必须由外部 bean 调用**，自调用会让 @Async 失效。 */
    @Async("mediaBatchExecutor")
    public void execute(long jobId) {
        MediaFullSyncJobRow job = jobMapper.selectById(jobId);
        if (job == null || !"PENDING".equals(job.getStatus())) {
            return;
        }
        long now = System.currentTimeMillis();
        job.setStatus("RUNNING");
        job.setStartedAt(now);
        job.setUpdatedAt(now);
        jobMapper.updateById(job);

        List<Integer> years = fromJson(job.getYearsJson());
        List<SyncRange> ranges = SyncRangePlanner.plan(years, fromJsonStr(job.getSeasonsJson()),
                fromJson(job.getMonthsJson()));
        int resumeFrom = job.getDoneRanges() == null ? 0 : job.getDoneRanges();
        if (resumeFrom > 0) {
            log.info("全量同步 {} 续跑：跳过前 {} 段", jobId, resumeFrom);
            job.setPhase(String.format("续跑（跳过前 %d/%d 段）", resumeFrom, ranges.size()));
            saveProgress(jobId, job, job.getPhase());
        }
        Set<String> seen = new LinkedHashSet<>();   // 跨段去重（同一部不会在两段里重复提交）
        List<String> truncated = new ArrayList<>();
        boolean cancelled = false;
        try {
            for (SyncRange range : ranges) {
                if (range.index() < resumeFrom) {
                    continue;   // 上次已整段跑完
                }
                if (isCancelled(jobId)) {
                    cancelled = true;
                    break;
                }
                job.setPhase(String.format("第 %d/%d 段：%s", range.index() + 1, ranges.size(), range.label()));
                saveProgress(jobId, job, job.getPhase());

                SyncRangeFetchResult fetched = syncService.discoverRange(
                        range.from(), range.to(), job.getRegion(), job.getCategory());
                if (fetched.truncated()) {
                    truncated.add(range.label());
                }

                List<SyncCommitRequest.Item> batch = new ArrayList<>(COMMIT_BATCH);
                for (MetadataCandidate candidate : fetched.candidates()) {
                    if (candidate.externalId() == null || !seen.add(candidate.externalId())) {
                        continue;
                    }
                    String action = SyncActionDecider.actionFor(candidate.matchType());
                    if ("SKIP".equals(action)) {
                        job.setSkipped(job.getSkipped() + 1);
                        job.setDoneItems(job.getDoneItems() + 1);
                        continue;
                    }
                    batch.add(new SyncCommitRequest.Item(candidate.externalId(), action, candidate.targetMediaId()));
                    if (batch.size() >= COMMIT_BATCH) {
                        if (!flush(jobId, job, batch)) {
                            cancelled = true;
                            break;
                        }
                        batch = new ArrayList<>(COMMIT_BATCH);
                    }
                }
                if (cancelled) {
                    break;
                }
                if (!batch.isEmpty() && !flush(jobId, job, batch)) {
                    cancelled = true;
                    break;
                }
                job.setDoneRanges(job.getDoneRanges() + 1);
                saveProgress(jobId, job, job.getPhase());
            }
            // 收尾：**再读一次 DB 状态**——晚到的取消也要认（进度写入不碰 status，所以这里读到的一定是真实意图）
            MediaFullSyncJobRow latest = jobMapper.selectById(jobId);
            boolean wasCancelled = latest != null && "CANCELLED".equals(latest.getStatus());
            boolean stop = cancelled || wasCancelled;
            job.setStatus(stop ? "CANCELLED" : "DONE");
            job.setPhase(stop ? "已取消" : "完成");
            String msg = summary(job, truncated, stop);
            if (resumeFrom > 0) {
                msg = "（续跑：跳过上次已跑完的前 " + resumeFrom + " 段）" + msg;
            }
            job.setMessage(msg);
        } catch (Exception e) {
            log.error("全量同步任务 {} 失败", jobId, e);
            job.setStatus("FAILED");
            job.setPhase("失败");
            job.setMessage(String.valueOf(e.getMessage()));
        } finally {
            job.setFinishedAt(System.currentTimeMillis());
            job.setUpdatedAt(System.currentTimeMillis());
            jobMapper.updateById(job);
        }
    }

    /**
     * 写进度：**只更新进度字段，绝不碰 `status`**。
     *
     * <p>⚠️ 这里曾经用 `updateById(job)`，而 MyBatis-Plus 会把内存行里非空的字段全部写回 ——
     * 包括 `status=RUNNING`，于是**把刚设的 `CANCELLED` 覆盖掉**，取消随机失效
     * （2026-09-25 实测：取消 2026 全年任务，一路跑到 4/4 段才 DONE）。
     */
    private void saveProgress(long jobId, MediaFullSyncJobRow job, String phase) {
        job.setUpdatedAt(System.currentTimeMillis());
        jobMapper.update(null, new LambdaUpdateWrapper<MediaFullSyncJobRow>()
                .eq(MediaFullSyncJobRow::getId, jobId)
                .set(MediaFullSyncJobRow::getPhase, phase)
                .set(MediaFullSyncJobRow::getDoneRanges, job.getDoneRanges())
                .set(MediaFullSyncJobRow::getDoneItems, job.getDoneItems())
                .set(MediaFullSyncJobRow::getAdded, job.getAdded())
                .set(MediaFullSyncJobRow::getUpdated, job.getUpdated())
                .set(MediaFullSyncJobRow::getSkipped, job.getSkipped())
                .set(MediaFullSyncJobRow::getFailed, job.getFailed())
                .set(MediaFullSyncJobRow::getUpdatedAt, job.getUpdatedAt()));
    }

    /** 提交一批；返回 false 表示已请求取消（当前批已跑完）。 */
    private boolean flush(long jobId, MediaFullSyncJobRow job, List<SyncCommitRequest.Item> batch) {
        if (isCancelled(jobId)) {
            return false;
        }
        SyncCommitResult result = commitService.commit(new SyncCommitRequest(batch));
        job.setAdded(job.getAdded() + result.added());
        job.setUpdated(job.getUpdated() + result.updated());
        job.setSkipped(job.getSkipped() + result.skipped());
        job.setFailed(job.getFailed() + result.failed());
        job.setDoneItems(job.getDoneItems() + batch.size());
        saveProgress(jobId, job, job.getPhase());   // 传 null 会让 phase 在批次间闪成空
        return true;
    }

    private boolean isCancelled(long jobId) {
        MediaFullSyncJobRow fresh = jobMapper.selectById(jobId);
        return fresh != null && "CANCELLED".equals(fresh.getStatus());
    }

    public MediaFullSyncJobRow cancel(long jobId) {
        MediaFullSyncJobRow job = get(jobId);
        if ("RUNNING".equals(job.getStatus()) || "PENDING".equals(job.getStatus())) {
            job.setStatus("CANCELLED");
            job.setPhase("取消中（当前批跑完即停）");
            job.setUpdatedAt(System.currentTimeMillis());
            jobMapper.updateById(job);
        }
        return job;
    }

    public MediaFullSyncJobRow get(long jobId) {
        MediaFullSyncJobRow row = jobMapper.selectById(jobId);
        if (row == null) {
            throw new NoSuchElementException("任务不存在: " + jobId);
        }
        return row;
    }

    public MediaFullSyncJobRow latest() {
        List<MediaFullSyncJobRow> rows = jobMapper.selectList(new LambdaQueryWrapper<MediaFullSyncJobRow>()
                .orderByDesc(MediaFullSyncJobRow::getId).last("LIMIT 1"));
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 同条件、上次没跑完的任务已完成的段数（作续跑起点）。
     *
     * <p>只认 `INTERRUPTED` / `CANCELLED` / `FAILED` —— **`DONE` 不算**：跑完过还想再跑，
     * 意图是拿 Bangumi 的新增，这时跳过任何段都是错的。
     */
    private int resumeOffset(MediaFullSyncJobRow candidate) {
        List<MediaFullSyncJobRow> prev = jobMapper.selectList(new LambdaQueryWrapper<MediaFullSyncJobRow>()
                .in(MediaFullSyncJobRow::getStatus, "INTERRUPTED", "CANCELLED", "FAILED")
                .orderByDesc(MediaFullSyncJobRow::getId)
                .last("LIMIT 10"));
        for (MediaFullSyncJobRow p : prev) {
            if (sameFilter(p, candidate)) {
                return p.getDoneRanges() == null ? 0 : p.getDoneRanges();
            }
        }
        return 0;
    }

    private static boolean sameFilter(MediaFullSyncJobRow a, MediaFullSyncJobRow b) {
        return eq(a.getYearsJson(), b.getYearsJson())
                && eq(a.getSeasonsJson(), b.getSeasonsJson())
                && eq(a.getMonthsJson(), b.getMonthsJson())
                && eq(a.getRegion(), b.getRegion())
                && eq(a.getCategory(), b.getCategory());
    }

    private static boolean eq(String a, String b) {
        String x = a == null ? "" : a.trim();
        String y = b == null ? "" : b.trim();
        return x.equals(y) || (x.isEmpty() && y.equals("[]")) || (y.isEmpty() && x.equals("[]"));
    }

    private String summary(MediaFullSyncJobRow job, List<String> truncated, boolean cancelled) {
        return (cancelled ? "已取消；" : "完成；")
                + "范围 " + job.getDoneRanges() + "/" + job.getTotalRanges() + " 段"
                + "，处理 " + job.getDoneItems() + " 条"
                + "（新增 " + job.getAdded() + " · 更新 " + job.getUpdated()
                + " · 跳过 " + job.getSkipped() + " · 失败 " + job.getFailed() + "）"
                + (truncated.isEmpty() ? "" : "；⚠️ 这些段撞到 Bangumi 1000 条上限，建议改选月份：" + String.join("、", truncated));
    }

    private static String toJson(List<?> list) {
        if (list == null || list.isEmpty()) {
            return "[]";
        }
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            Object v = list.get(i);
            sb.append(v instanceof Number ? v.toString() : '"' + String.valueOf(v) + '"');
        }
        return sb.append(']').toString();
    }

    private static List<Integer> fromJson(String json) {
        List<Integer> out = new ArrayList<>();
        for (String part : fromJsonStr(json)) {
            try {
                out.add(Integer.valueOf(part));
            } catch (NumberFormatException ignored) {
                // 非数字忽略
            }
        }
        return out;
    }

    private static List<String> fromJsonStr(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        String body = json.trim().replaceAll("^\\[|\\]$", "");
        if (body.isBlank()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String part : body.split(",")) {
            String v = part.trim().replaceAll("^\"|\"$", "");
            if (!v.isEmpty()) {
                out.add(v);
            }
        }
        return out;
    }
}
