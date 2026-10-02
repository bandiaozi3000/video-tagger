package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 「局部重渲/续渲跳过 probe」的分块表复原（用户 2026-10-01 方案 A）。
 *
 * 覆盖两件真会踩的事：
 *   1. **库里存的是裸 JSON 数组**，而 `RenderChunks.parseBoundaryFrames` 吃的是 probe 输出形态 ——
 *      第一次对拍时就是因为这个差点让 A 方案静默失效（解析成空表 → 老实回退 probe，功能看着"没生效"）；
 *   2. fps 只能从 `requestJson.groupStyle` 推（银幕式 24 / 其余 30），推错 → 块表全错。
 *
 * 这里用**真实任务行数据**（任务 #10：银幕式 / 12 块）当基准，块区间与当年 `concat-list.txt` 逐块一致。
 */
class VideoExportTaskServiceTest {

    /** 任务 #10 的真实 `video_export_task.boundary_frames`（银幕式，fps=24，总帧 42297）。 */
    private static final String BF_CINEMA =
            "[0,132,240,288,4118,4166,8414,8462,16956,17004,24567,24615,33411,33459,41913,42297]";

    /** 任务 #10 的 `request_json`（截取到 groupStyle，其余字段与本方法无关）。 */
    private static final String RJ_CINEMA = "{\"ids\":[11351,8299],\"groupStyle\":\"cinema\"}";

    /** 任务 #9 的真实 `boundary_frames`（章节式，fps=30，总帧 30856；那段导出时长 17 分钟）。 */
    private static final String BF_CHAPTER = "[0,510,1020,1230,1470,1680,1920,2130,2370,2580,2820,3030,3270,3510,3720,3960,4170,4410,4620,4860,5100,5310,5550,5790,6000,6240,6450,6690,6900,7140,7380,7620,7830,8070,8310,8550,8760,9000,9240,9480,9720,9930,10170,10410,10650,10860,11100,11340,11550,11790,12030,12270,12510,12750,12960,13200,13440,13680,13920,14130,14370,14610,14850,15090,15300,15540,15780,16020,16260,16500,16710,16950,17190,17430,17670,17910,18150,18360,18600,18840,19080,19320,19560,19800,20010,20250,20490,20730,20970,21210,21450,21690,21930,22140,22380,22620,22860,23100,23340,23580,23820,24060,24300,24510,24750,24990,25230,25470,25710,25950,26190,26430,26640,26880,27120,27360,27600,27840,28080,28290,28477,28687,29240,29450,29813,30023,30376,30856]";

    @Test
    void 银幕式任务行复原出与当年一致的分块表() {
        RecommendVideoService.KnownPlan plan = VideoExportTaskService.knownPlanOf(BF_CINEMA, RJ_CINEMA, 12, "局部重渲");
        assertNotNull(plan);
        assertEquals(24, plan.fps(), "银幕式 = 24fps（RecommendService.fpsOf）");
        assertEquals(12, plan.chunks().size());
        assertEquals("局部重渲", plan.stageLabel());
        // 块表必须**首尾相接、覆盖 [0, 总帧数)**
        assertEquals(0, plan.chunks().get(0).fromFrame());
        assertEquals(42296, plan.chunks().get(plan.chunks().size() - 1).toFrame());
        for (int i = 1; i < plan.chunks().size(); i++) {
            assertEquals(plan.chunks().get(i - 1).toFrame() + 1, plan.chunks().get(i).fromFrame());
        }
        // 与当年 concat-list.txt 的首末两块对齐（124s 级 → 此处 132.000s / 128.250s）
        assertEquals(3168, plan.chunks().get(0).frames());
        assertEquals(3078, plan.chunks().get(11).frames());
    }

    @Test
    void 章节式真实任务9按30fps复原() {
        RecommendVideoService.KnownPlan plan = VideoExportTaskService.knownPlanOf(BF_CHAPTER,
                "{\"groupStyle\":\"chapter\"}", 9, "续渲");
        assertNotNull(plan);
        assertEquals(30, plan.fps(), "章节式 = 30fps");
        assertEquals(9, plan.chunks().size());
        // 与当年 concat-list.txt 对得上的两块：首块 124.000s、末块 34.767s
        assertEquals(3720, plan.chunks().get(0).frames());
        assertEquals(1043, plan.chunks().get(8).frames());
        assertEquals(30856, plan.chunks().get(8).toFrame() + 1, "末块要盖到总帧数");
    }

    @Test
    void 缺数据或不自洽时回退probe() {
        // 旧任务：没有边界 / 没有 requestJson
        assertNull(VideoExportTaskService.knownPlanOf(null, RJ_CINEMA, 12, "续渲"));
        assertNull(VideoExportTaskService.knownPlanOf("", RJ_CINEMA, 12, "续渲"));
        assertNull(VideoExportTaskService.knownPlanOf(BF_CINEMA, null, 12, "续渲"));
        assertNull(VideoExportTaskService.knownPlanOf(BF_CINEMA, "{\"title\":\"没有 groupStyle\"}", 12, "续渲"));
        // 不自洽：任务行块数与按边界复原的不一致（fps 口径变过 / 手改过）→ 宁可回退 probe，不能拼错片
        assertNull(VideoExportTaskService.knownPlanOf(BF_CINEMA, RJ_CINEMA, 9, "续渲"));
        // 边界退化（全是 0）→ 算不出块 → 回退
        assertNull(VideoExportTaskService.knownPlanOf("[0,0]", RJ_CINEMA, null, "续渲"));
    }

    @Test
    void 库里存的是裸数组所以必须包一层才能解析() {
        // ⚠️ 这就是 A 方案差点静默失效的坑：`onBoundaries` 往库里写的是**裸数组**，
        //    而 `RenderChunks.parseBoundaryFrames` 吃的是 probe 输出形态（要 `"boundaryFrames":` 前缀）——
        //    直接喂裸数组会得到空表 → knownPlanOf 回退 probe（功能看着"没生效"）。
        assertEquals(List.of(), RenderChunks.parseBoundaryFrames("[0,165,1173]"), "裸数组本身解析不出来（已知行为）");
        assertEquals(List.of(0, 165, 1173), RenderChunks.parseBoundaryFrames("{\"boundaryFrames\":[0,165,1173]}"));
        // 而 `knownPlanOf` 自己包一层 → 库里那条真实记录能复原（上两个用例就是证据）
        assertNotNull(VideoExportTaskService.knownPlanOf(BF_CINEMA, RJ_CINEMA, 12, "续渲"));
    }
}
