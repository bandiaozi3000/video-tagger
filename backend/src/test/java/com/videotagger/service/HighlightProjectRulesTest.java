package com.videotagger.service;

import com.videotagger.entity.HighlightProjectItem;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class HighlightProjectRulesTest {
    @Test
    void fullExportKeepsAllSpoilerStates() {
        assertEquals(3, HighlightProjectRules.selectableCount("FULL", "PENDING", "SAFE", "SPOILER"));
    }

    @Test
    void safeExportOnlyKeepsConfirmedSafeItems() {
        assertEquals(1, HighlightProjectRules.selectableCount("SAFE", "PENDING", "SAFE", "SPOILER"));
    }

    @Test
    void rangeMustHaveStrictlyIncreasingEndpoints() {
        assertDoesNotThrow(() -> HighlightProjectRules.validateRange(1.0, 2.0));
        assertThrows(IllegalArgumentException.class, () -> HighlightProjectRules.validateRange(2.0, 2.0));
        assertThrows(IllegalArgumentException.class, () -> HighlightProjectRules.validateRange(2.0, null));
    }

    @Test
    void pendingSourceBlocksExport() {
        HighlightProjectItem item = new HighlightProjectItem();
        item.setSourceState("PENDING");
        assertThrows(IllegalArgumentException.class, () -> HighlightProjectRules.requireReady(item));
    }
}
