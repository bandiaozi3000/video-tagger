package com.videotagger.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
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
        service = new RecommendVideoService(recommendService,
                "scripts", "node", "chrome", "ffmpeg");
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
        verify(recommendService, never()).buildHtml(org.mockito.ArgumentMatchers.anyList());
    }

    @Test
    void unknownFormatThrows() {
        assertThrows(IllegalArgumentException.class, () -> service.render(List.of(1L), null, "AVI", "1080P"));
        // 未走到 HTML 生成
        verify(recommendService, never()).buildHtml(org.mockito.ArgumentMatchers.anyList());
    }

    @Test
    void lowerOrMixedCaseFormatNormalized() {
        // 大小写不敏感：MP4 / mp4 / WebM 均应归一化到 FORMATS 键
        assertThrows(IllegalArgumentException.class, () -> service.render(List.of(1L), null, "WebmXX", "1080P"));
    }
}
