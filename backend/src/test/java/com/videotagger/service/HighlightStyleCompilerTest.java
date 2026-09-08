package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Clip;
import com.videotagger.entity.HighlightProjectItem;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.service.HighlightStylePackRegistry;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HighlightStyleCompilerTest {
    private final HighlightStyleCompiler compiler = new HighlightStyleCompiler(new ObjectMapper());

    @Test
    void defaultsProduceOpeningClipAndEndingScenes() {
        HighlightProjectItem item = new HighlightProjectItem();
        item.setId(7L);
        item.setInSec(1.0);
        item.setOutSec(3.5);
        HighlightStyleCompiler.ScenePlan plan = compiler.plan("{}", 12L, List.of(item));
        assertEquals("opening-card", plan.scenes().get(0).type());
        assertEquals("clip", plan.scenes().get(1).type());
        assertEquals("ending-card", plan.scenes().get(plan.scenes().size() - 1).type());
    }

    @Test
    void manySelectedClipsAcrossEpisodesGetChapterCards() {
        ClipMapper clips = mock(ClipMapper.class);
        Clip first = new Clip(); first.setId(11L); first.setEpisodeId(101L);
        Clip second = new Clip(); second.setId(12L); second.setEpisodeId(101L);
        Clip third = new Clip(); third.setId(13L); third.setEpisodeId(102L);
        Clip fourth = new Clip(); fourth.setId(14L); fourth.setEpisodeId(102L);
        when(clips.listByMedia(7L)).thenReturn(List.of(first, second, third, fourth));
        HighlightStyleCompiler withChapters = new HighlightStyleCompiler(new ObjectMapper(),
                new HighlightStylePackRegistry(new ObjectMapper(), new HighlightProperties()), clips);

        HighlightStyleCompiler.ScenePlan plan = withChapters.plan("{}", 7L,
                List.of(itemWithClip(1L, 11L, 0, 1), itemWithClip(2L, 12L, 1, 2),
                        itemWithClip(3L, 13L, 2, 3), itemWithClip(4L, 14L, 3, 4)));

        assertEquals(2, plan.scenes().stream().filter(s -> "chapter-card".equals(s.type())).count());
        HighlightStyleCompiler.ScenePlan withoutChapters = withChapters.plan("{\"chaptersEnabled\":false}", 7L,
                List.of(itemWithClip(1L, 11L, 0, 1), itemWithClip(2L, 12L, 1, 2),
                        itemWithClip(3L, 13L, 2, 3), itemWithClip(4L, 14L, 3, 4)));
        assertEquals(0, withoutChapters.scenes().stream().filter(s -> "chapter-card".equals(s.type())).count());
    }

    @Test
    void unsupportedRendererFailsBeforeExport() {
        assertThrows(IllegalArgumentException.class,
                () -> compiler.compile("{\"transitionRenderer\":\"glitch\"}"));
    }

    @Test
    void crossfadeStyleCreatesTransitionScene() {
        HighlightProjectItem first = item(1L, 0, 2);
        HighlightProjectItem second = item(2L, 3, 5);
        HighlightStyleCompiler.ScenePlan plan = compiler.plan("{\"transitionRenderer\":\"crossfade\"}", 12L, List.of(first, second));
        assertEquals(3, plan.scenes().stream().filter(s -> "transition".equals(s.type())).count());
    }

    private static HighlightProjectItem item(long id, double in, double out) {
        return itemWithClip(id, null, in, out);
    }

    private static HighlightProjectItem itemWithClip(long id, Long clipId, double in, double out) {
        HighlightProjectItem item = new HighlightProjectItem();
        item.setId(id);
        item.setClipId(clipId);
        item.setInSec(in);
        item.setOutSec(out);
        return item;
    }
}
