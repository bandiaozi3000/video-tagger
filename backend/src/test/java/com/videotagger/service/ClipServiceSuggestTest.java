package com.videotagger.service;

import com.videotagger.mapper.AnimeMapper;
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

    ClipMapper clipMapper;
    ClipService service;

    @BeforeEach
    void setUp() {
        clipMapper = mock(ClipMapper.class);
        service = new ClipService(clipMapper, mock(AnimeMapper.class), mock(EpisodeMapper.class),
                mock(TagMapper.class), mock(ClipTagMapper.class),
                mock(CoverService.class), mock(EmbeddingTaskService.class));
    }

    @Test
    void suggestTagsSplitsMultiWordTagsAndFiltersByPrefix() {
        when(clipMapper.countTags(500)).thenReturn(List.of(
                new TagSuggestion("高燃 战斗", 2L),
                new TagSuggestion("高燃", 1L),
                new TagSuggestion("泪目", 3L)));

        List<TagSuggestion> hits = service.suggestTags("高", 10);

        assertEquals(List.of(new TagSuggestion("高燃", 3L)), hits);
    }

    @Test
    void suggestTagsEmptyPrefixRanksByCount() {
        when(clipMapper.countTags(500)).thenReturn(List.of(
                new TagSuggestion("高燃 战斗", 2L),
                new TagSuggestion("泪目", 3L)));

        List<TagSuggestion> hits = service.suggestTags("", 10);

        // 泪目(3) > 战斗(2) = 高燃(2)；同级按名称升序（战斗 U+6218 < 高燃 U+9AD8）
        assertEquals(List.of(
                new TagSuggestion("泪目", 3L),
                new TagSuggestion("战斗", 2L),
                new TagSuggestion("高燃", 2L)), hits);
    }

    @Test
    void appendTagMergesAndDeduplicates() {
        assertEquals("高燃 名场面", ClipService.appendTag("高燃", "名场面"));
        assertEquals("高燃", ClipService.appendTag("高燃", "高燃"));
        assertEquals("高燃 名场面 泪目", ClipService.appendTag("高燃 名场面", "泪目"));
        assertEquals("高燃", ClipService.appendTag("高燃", "  "));
    }
}
