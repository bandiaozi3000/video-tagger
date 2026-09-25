package com.videotagger.controller;

import com.videotagger.entity.MediaFullSyncJobRow;
import com.videotagger.metadata.MediaFullSyncJobService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 「全量同步」：按筛选条件把符合条件的番剧**全部**同步进来（跳过"拉取候选"这一步），后台跑。
 *
 * <p>同步动作与弹窗逐条勾选同源（同一个 {@code SyncActionDecider} + 同一个 commit），所以幂等。
 */
@RestController
@RequestMapping("/api/media/full-sync")
public class MediaFullSyncController {

    private final MediaFullSyncJobService jobService;

    public MediaFullSyncController(MediaFullSyncJobService jobService) {
        this.jobService = jobService;
    }

    /** 起一个全量同步任务。筛选条件与弹窗「选范围」一一对应。 */
    @PostMapping("/start")
    public MediaFullSyncJobRow start(@RequestBody(required = false) MediaFullSyncJobService.StartRequest request) {
        MediaFullSyncJobRow job = jobService.create(request);
        // 必须由外部 bean 调用 execute，自调用会让 @Async 失效
        jobService.execute(job.getId());
        return job;
    }

    @GetMapping("/job/latest")
    public MediaFullSyncJobRow latest() {
        return jobService.latest();
    }

    @GetMapping("/job/{id}")
    public MediaFullSyncJobRow job(@PathVariable long id) {
        return jobService.get(id);
    }

    /** 取消：只在**批次边界**停，不掐断正在飞的写请求。 */
    @PostMapping("/job/{id}/cancel")
    public MediaFullSyncJobRow cancel(@PathVariable long id) {
        return jobService.cancel(id);
    }
}
