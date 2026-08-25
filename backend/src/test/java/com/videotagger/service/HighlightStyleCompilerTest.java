package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.HighlightProjectItem;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
        HighlightProjectItem item = new HighlightProjectItem();
        item.setId(id);
        item.setInSec(in);
        item.setOutSec(out);
        return item;
    }
}
