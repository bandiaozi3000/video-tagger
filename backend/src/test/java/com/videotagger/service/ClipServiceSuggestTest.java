package com.videotagger.service;

import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ClipServiceSuggestTest {

    TagMapper tagMapper;
    ClipService service;

    @BeforeEach
    void setUp() {
        tagMapper = mock(TagMapper.class);
        service = new ClipService(mock(ClipMapper.class), mock(MediaMapper.class),
                mock(MediaFormatMapper.class), mock(MediaSubcategoryMapper.class),
                mock(EpisodeMapper.class), tagMapper, mock(ClipTagMapper.class),
                mock(CoverService.class), mock(EmbeddingTaskService.class));
    }

    @Test
    void suggestGlobalFiltersPrefixAndRanksByTotal() {
        when(tagMapper.countGlobal()).thenReturn(List.of(
                new TagUsage(1L, "高燃", 1L, 0, 1, 5, 0),
                new TagUsage(2L, "战斗", 1L, 0, 0, 2, 0),
                new TagUsage(3L, "泪目", 1L, 0, 0, 3, 0)));

        List<TagSuggestion> hits = service.suggestTags("高", 10, null);

        // 只保留含"高"的；次数 = 三级引用合计
        assertEquals(List.of(new TagSuggestion("高燃", 6L)), hits);
    }

    @Test
    void suggestMediaContextPrioritizesMediaTagsThenGlobalFallback() {
        when(tagMapper.countByMedia(42L)).thenReturn(List.of(
                new TagUsage(1L, "乱马专有", 1L, 0, 0, 0, 2)));
        when(tagMapper.countGlobal()).thenReturn(List.of(
                new TagUsage(1L, "乱马专有", 1L, 0, 0, 0, 2),
                new TagUsage(2L, "高燃", 1L, 0, 0, 0, 9)));

        List<TagSuggestion> hits = service.suggestTags("", 10, 42L);

        // 媒体已用标签排前（即便全局次数更低），全局高频兜底去重
        assertEquals(List.of(
                new TagSuggestion("乱马专有", 2L),
                new TagSuggestion("高燃", 9L)), hits);
    }

    @Test
    void suggestExactPrefixOutranksSubstringEvenWithLowerCount() {
        when(tagMapper.countGlobal()).thenReturn(List.of(
                new TagUsage(1L, "高燃", 1L, 0, 0, 5, 0),
                new TagUsage(2L, "高燃剪辑", 1L, 0, 0, 3, 0),
                new TagUsage(3L, "略高燃", 1L, 0, 0, 9, 0)));

        List<TagSuggestion> hits = service.suggestTags("高燃", 10, null);

        // 精确命中(高燃) > 前缀(高燃剪辑) > 包含(略高燃)，次数不压权重
        assertEquals(List.of(
                new TagSuggestion("高燃", 5L),
                new TagSuggestion("高燃剪辑", 3L),
                new TagSuggestion("略高燃", 9L)), hits);
    }

    @Test
    void appendTagMergesAndDeduplicates() {
        assertEquals("高燃 名场面", ClipService.appendTag("高燃", "名场面"));
        assertEquals("高燃", ClipService.appendTag("高燃", "高燃"));
        assertEquals("高燃 名场面 泪目", ClipService.appendTag("高燃 名场面", "泪目"));
        assertEquals("高燃", ClipService.appendTag("高燃", "  "));
    }
}
