package com.videotagger.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** LLM 归组的候选预筛逻辑（纯文本，无 LLM 调用）。 */
class GroupingServiceTest {

    @Test
    void roughMatchDetectsSubstring() {
        assertTrue(GroupingService.roughMatch("葬送的芙莉莲", "葬送的芙莉莲 魔法考试篇"));
        assertTrue(GroupingService.roughMatch("芙莉莲", "葬送的芙莉莲"));
    }

    @Test
    void roughMatchDetectsWordOverlap() {
        assertTrue(GroupingService.roughMatch("Frieren", "Frieren Beyond Journey's End"));
    }

    @Test
    void roughMatchRejectsUnrelated() {
        assertFalse(GroupingService.roughMatch("进击的巨人", "灌篮高手"));
        assertFalse(GroupingService.roughMatch("轻音少女", "孤独摇滚"));
    }

    @Test
    void roughMatchRequiresTwoChars() {
        assertFalse(GroupingService.roughMatch("a", "ab"));
        assertFalse(GroupingService.roughMatch(null, "abc"));
        assertFalse(GroupingService.roughMatch("abc", null));
    }
}
