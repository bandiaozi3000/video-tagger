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

    @Test
    void tooManyIdsThrows() {
        List<Long> many = java.util.stream.LongStream.range(1, 32).boxed().toList();
        assertThrows(IllegalArgumentException.class, () -> service.render(many, null, "MP4", "1080P"));
    }

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
