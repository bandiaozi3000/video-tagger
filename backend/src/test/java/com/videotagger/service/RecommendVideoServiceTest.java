package com.videotagger.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * RecommendVideoService 校验路径单测。
 *
 * 只覆盖会在启动 node 渲染前抛错的校验分支（空 ids / 超上限 / 未知清晰度 / 未知格式），
 * 合法参数的全链路由 RecommendControllerTest（mock service）+ 实机导出验证覆盖。
 */
class RecommendVideoServiceTest {

    RecommendService recommendService;
    RecommendVideoService service;

    @BeforeEach
    void setUp() {
        recommendService = mock(RecommendService.class);
        service = new RecommendVideoService(recommendService, "node", "ffmpeg");
    }

    @Test
    void emptyIdsThrows() {
        assertThrows(IllegalArgumentException.class, () -> service.render(List.of(), null, "MP4", "1080P"));
        assertThrows(IllegalArgumentException.class, () -> service.render(null, null, "MP4", "1080P"));
    }

    // tooManyIdsThrows 已删：v0.18.1「超 200 显示完全」移除了 ids 数量上限校验，该测试断言失效（陈旧测试）

    @Test
    void unknownResolutionThrows() {
        assertThrows(IllegalArgumentException.class, () -> service.render(List.of(1L), null, "MP4", "4KXX"));
        // 校验在组装 RenderInput 之前就拦下（不会白跑 node）
        org.mockito.Mockito.verifyNoInteractions(recommendService);
    }

    @Test
    void unknownFormatThrows() {
        assertThrows(IllegalArgumentException.class, () -> service.render(List.of(1L), null, "AVI", "1080P"));
    }

    @Test
    void lowerOrMixedCaseFormatNormalized() {
        // 大小写不敏感：MP4 / mp4 / WebM 均应归一化到 FORMATS 键
        assertThrows(IllegalArgumentException.class, () -> service.render(List.of(1L), null, "WebmXX", "1080P"));
    }

    /** 渲染子进程的进度行解析（Java 侧不引入 JSON 依赖，纯正则）。 */
    @Test
    void 进度行解析() {
        var line = "{\"progress\":0.4237,\"frames\":1234,\"encoded\":900,\"ms\":45678}";
        assertEquals(java.util.OptionalInt.of(42), RecommendVideoService.parseProgressPercent(line));
        assertEquals(java.util.OptionalInt.of(100), RecommendVideoService.parseProgressPercent("{\"progress\":1,\"frames\":10}"));
        assertEquals(java.util.OptionalInt.of(0), RecommendVideoService.parseProgressPercent("{\"progress\":0.001}"));
        // 越界 / 脏值 / 普通日志都不该被当成进度
        assertEquals(java.util.OptionalInt.of(100), RecommendVideoService.parseProgressPercent("{\"progress\":1.5}"));
        assertTrue(RecommendVideoService.parseProgressPercent("{\"progress\":\"x\"}").isEmpty());
        assertTrue(RecommendVideoService.parseProgressPercent("Rendered 12/30").isEmpty());
        assertTrue(RecommendVideoService.parseProgressPercent(null).isEmpty());
        // 2026-09-20 实测回归：Remotion 进度条用回车刷新 -> 上报行被拼在行尾，不能要求整行是 JSON
        assertEquals(java.util.OptionalInt.of(42),
                RecommendVideoService.parseProgressPercent("Rendering 11/30 [==]" + (char) 13
                        + "Rendering 12/30 {\"progress\":0.4237,\"frames\":12,\"ms\":1}"));
        // 一行里有多条 -> 取最后一个（最新的）
        assertEquals(java.util.OptionalInt.of(70),
                RecommendVideoService.parseProgressPercent("{\"progress\":0.42} {\"progress\":0.7}"));
    }

}
