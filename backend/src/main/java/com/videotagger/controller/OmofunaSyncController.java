package com.videotagger.controller;

import com.videotagger.service.OmofunaSyncTaskService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * omofuna 番剧同步（中文源）：POST 创建后台抓取任务（立即返回 taskId），GET 轮询进度。
 *
 * 抓取 20~40 分钟异步执行，POST 不阻塞；GET /current 供前端刷新页面后恢复进度。
 * 同 AniList sync-anilist 的入参风格：body {"years":[2026,...]}。
 */
@RestController
@RequestMapping("/api/media/sync-omofuna")
// 外部同步功能默认禁用（D9：同步暂不考虑，手动维护）；videotagger.sync.enabled=true 时才启用，代码保留
@ConditionalOnProperty(name = "videotagger.sync.enabled", havingValue = "true")
public class OmofunaSyncController {

    private final OmofunaSyncTaskService taskService;

    public OmofunaSyncController(OmofunaSyncTaskService taskService) {
        this.taskService = taskService;
    }

    /** 同步请求：years 年份多选；types 可选类目过滤（1 日漫/5 动画/24 剧场，空=全部）。 */
    public record SyncOmofunaRequest(List<Integer> years, List<Integer> types) {
    }

    /** 创建 omofuna 同步任务并异步启动，立即返回任务快照（RUNNING）。 */
    @PostMapping
    public OmofunaSyncTaskService.OmofunaTask start(@RequestBody SyncOmofunaRequest req) {
        List<Integer> years = req.years() == null ? List.of() : req.years();
        OmofunaSyncTaskService.OmofunaTask task = taskService.create(years, req.types());
        taskService.execute(task.taskId(), task.years(), task.types());
        return task;
    }

    /** 轮询任务状态；不存在 → 404。 */
    @GetMapping("/{taskId}")
    public OmofunaSyncTaskService.OmofunaTask get(@PathVariable String taskId) {
        OmofunaSyncTaskService.OmofunaTask task = taskService.get(taskId);
        if (task == null) {
            throw new NoSuchElementException("同步任务不存在: " + taskId);
        }
        return task;
    }

    /** 最近一次任务（刷新恢复）：RUNNING 续轮询 / DONE·ERROR 展示结果 / null 全新。 */
    @GetMapping("/current")
    public OmofunaSyncTaskService.OmofunaTask current() {
        return taskService.current();
    }
}
