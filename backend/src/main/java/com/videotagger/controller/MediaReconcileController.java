package com.videotagger.controller;

import com.videotagger.mapper.MediaReconcileMapper;
import com.videotagger.entity.MediaReconcileJobRow;
import com.videotagger.reconcile.MediaReconcileJobService;
import com.videotagger.reconcile.MediaReconcilePlanner;
import com.videotagger.reconcile.ReconcileDecision;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 媒体库对账：**只读盘点**接口。
 *
 * <p>当前只有「看」的能力（summary / plan），**没有**任何写接口 —— 执行阶段的
 * LINK / MERGE / PURGE 与后台任务（V39 任务表）尚未接入。
 */
@RestController
@RequestMapping("/api/media/reconcile")
public class MediaReconcileController {

    /** 单次盘点上限：一条 media 要打一次 Bangumi 搜索，不能让一个 HTTP 请求挂十几分钟。 */
    private static final int MAX_BATCH = 500;

    private final MediaReconcileMapper mapper;
    private final MediaReconcilePlanner planner;
    private final MediaReconcileJobService jobService;

    public MediaReconcileController(MediaReconcileMapper mapper, MediaReconcilePlanner planner,
                                    MediaReconcileJobService jobService) {
        this.mapper = mapper;
        this.planner = planner;
        this.jobService = jobService;
    }

    /** 待盘点的总量（先知道要跑多久）。 */
    @GetMapping("/summary")
    public Summary summary() {
        return new Summary(mapper.countUnlinked());
    }

    /**
     * 盘点一批未关联 media（**只读**，不写任何表）。
     *
     * @param afterId id 游标（只取大于它的；不是 OFFSET）
     */
    @PostMapping("/plan")
    public PlanResponse plan(@RequestBody(required = false) PlanRequest request) {
        PlanRequest safe = request == null ? new PlanRequest(0, 0) : request;
        int limit = Math.min(Math.max(safe.limit(), 1), MAX_BATCH);
        long afterId = Math.max(safe.afterId(), 0);
        MediaReconcilePlanner.PlanResult result = planner.plan(limit, afterId);
        return new PlanResponse(result.scanned(), result.auto(), result.link(), result.merge(),
                result.purgeNoRefs(), result.purgeNear(), result.purgeNone(), result.lastId(), result.decisions());
    }

    public record PlanRequest(int limit, long afterId) {
    }

    public record Summary(int unlinkedTotal) {
    }

    public record PlanResponse(int scanned, int auto, int link, int merge,
                               int purgeNoRefs, int purgeNear, int purgeNone, long lastId,
                               List<ReconcileDecision> decisions) {
    }

    // ---------- 后台任务 ----------

    /**
     * 起一个对账任务（后台跑）。
     *
     * <p>{@code mode=dry} 只报告不写；{@code mode=live} 真删真关联，需带确认词
     * {@link MediaReconcileJobService#CONFIRM_TOKEN}，**且必须先有过一次 DONE 的 dry 任务**。
     */
    @PostMapping("/start")
    public MediaReconcileJobRow start(@RequestBody StartRequest request) {
        StartRequest safe = request == null ? new StartRequest(null, null) : request;
        MediaReconcileJobRow job = jobService.create(safe.mode(), safe.confirmToken());
        // 必须由外部 bean 调用 execute，自调用会让 @Async 失效（本项目已踩过这个坑）
        jobService.execute(job.getId());
        return job;
    }

    @GetMapping("/job/latest")
    public MediaReconcileJobRow latest() {
        return jobService.latest();
    }

    @GetMapping("/job/{id}")
    public MediaReconcileJobRow job(@PathVariable long id) {
        return jobService.get(id);
    }

    /** 取消：只在**批次边界**停，不掐断正在飞的写请求。 */
    @PostMapping("/job/{id}/cancel")
    public MediaReconcileJobRow cancel(@PathVariable long id) {
        return jobService.cancel(id);
    }

    /** 明细（AUTO / 人工两层 / 失败项）；PURGE 只计数不存明细。前端拿它导 CSV。 */
    @GetMapping("/job/{id}/detail")
    public String detail(@PathVariable long id) {
        MediaReconcileJobRow row = jobService.get(id);
        return row.getDetailJson() == null ? "[]" : row.getDetailJson();
    }

    public record StartRequest(String mode, String confirmToken) {
    }
}
