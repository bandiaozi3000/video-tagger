package com.videotagger.controller;

import com.videotagger.service.StatsResponse;
import com.videotagger.service.StatsService;
import com.videotagger.service.StatsTrendResponse;
import com.videotagger.service.StatsTrendVideoService;
import com.videotagger.service.TrendRef;
import com.videotagger.service.TrendVideoRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService statsService;
    private final StatsTrendVideoService videoService;

    public StatsController(StatsService statsService, StatsTrendVideoService videoService) {
        this.statsService = statsService;
        this.videoService = videoService;
    }

    @GetMapping
    public StatsResponse stats() {
        return statsService.stats();
    }

    /**
     * v0.32 第一部分：筛选命中的媒体按首播年份计数（趋势折线/柱状的数据源）。
     *
     * <p>参数与 `GET /api/media` **同名同类型**，后端逐字复用同一批 filter 常量 → 口径一致
     * （同一筛选条件下，这里的 `total` 必等于 `/api/media` 的命中数）。
     */
    @GetMapping("/media-trend")
    public StatsTrendResponse mediaTrend(@RequestParam(required = false) List<String> status,
                                         @RequestParam(required = false) String format,
                                         @RequestParam(required = false) Long subcategoryId,
                                         @RequestParam(required = false) Integer confirmed,
                                         @RequestParam(required = false) List<Long> collectionId,
                                         @RequestParam(required = false) List<Integer> year,
                                         @RequestParam(required = false) String source,
                                         @RequestParam(required = false) List<Long> tagIds,
                                         @RequestParam(required = false) String tagMode,
                                         @RequestParam(required = false) String genreMode,
                                         @RequestParam(required = false) String collectionMode,
                                         @RequestParam(required = false) String q,
                                         @RequestParam(required = false) List<String> genres,
                                         @RequestParam(required = false) List<String> season) {
        return statsService.trend(status, format, subcategoryId, confirmed, collectionId, year, source,
                tagIds, tagMode, genreMode, collectionMode, q, genres, season);
    }

    /**
     * v0.32 第一部分：某年的代表作（趋势小卡 / 视频定格）——同一套筛选 + 评分口径。
     *
     * <p>`scoreSource`：`bgm`（Bangumi 分 + ≥100 票门槛）/ `personal`（个人评分，不套门槛）/
     * 缺省或其它 = `mixed`（个人优先、未评分回落 Bangumi）。`year` 缺省 = 不限年份。
     */
    @GetMapping("/media-trend/refs")
    public List<TrendRef> mediaTrendRefs(@RequestParam(required = false) List<String> status,
                                         @RequestParam(required = false) String format,
                                         @RequestParam(required = false) Long subcategoryId,
                                         @RequestParam(required = false) Integer confirmed,
                                         @RequestParam(required = false) List<Long> collectionId,
                                         @RequestParam(required = false) String source,
                                         @RequestParam(required = false) List<Long> tagIds,
                                         @RequestParam(required = false) String tagMode,
                                         @RequestParam(required = false) String genreMode,
                                         @RequestParam(required = false) String collectionMode,
                                         @RequestParam(required = false) String q,
                                         @RequestParam(required = false) List<String> genres,
                                         @RequestParam(required = false) List<String> season,
                                         @RequestParam(required = false) Integer year,
                                         @RequestParam(required = false) String scoreSource,
                                         @RequestParam(required = false) Integer limit) {
        return statsService.trendRefs(status, format, subcategoryId, confirmed, collectionId, source,
                tagIds, tagMode, genreMode, collectionMode, q, genres, season, year, scoreSource, limit);
    }

    /**
     * v0.32 第二部分：起一支统计视频渲染（**内存态任务**，不落库、不进导出队列；重启即丢）。
     *
     * <p>并发只允许 1 支 → 已有任务在跑时返回 409 `{code,message}`（全局异常处理器）。
     */
    @PostMapping("/media-trend/video")
    public StatsTrendVideoService.Task startTrendVideo(@RequestBody TrendVideoRequest request) {
        return videoService.start(request);
    }

    /** 查渲染进度（前端轮询）：`status` = RUNNING / DONE / ERROR；`url` 是 `/exports/**` 下的播放地址。 */
    @GetMapping("/media-trend/video/{taskId}")
    public StatsTrendVideoService.Task trendVideoStatus(@PathVariable String taskId) {
        return videoService.status(taskId);
    }

    /**
     * v0.32 第二部分：每年「当年第一名」的代表作（视频封面小头像用）。
     *
     * <p>页内预览走这个接口自己拼 `yearCovers`；正式渲染由后端内部取数（不走 HTTP）。
     */
    @GetMapping("/media-trend/year-refs")
    public List<com.videotagger.mapper.MediaMapper.YearTopRef> trendYearRefs(
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) String format,
            @RequestParam(required = false) Long subcategoryId,
            @RequestParam(required = false) Integer confirmed,
            @RequestParam(required = false) List<Long> collectionId,
            @RequestParam(required = false) List<Integer> year,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) List<Long> tagIds,
            @RequestParam(required = false) String tagMode,
            @RequestParam(required = false) String genreMode,
            @RequestParam(required = false) String collectionMode,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) List<String> season,
            @RequestParam(required = false) String scoreSource) {
        return statsService.trendYearRefs(status, format, subcategoryId, confirmed, collectionId, year, source,
                tagIds, tagMode, genreMode, collectionMode, q, genres, season, scoreSource);
    }
}
