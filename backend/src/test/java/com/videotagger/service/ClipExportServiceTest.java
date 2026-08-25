package com.videotagger.service;

import com.videotagger.entity.Clip;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClipExportServiceTest {
    @Test
    void frameMiddleUsesStartWhenEndMissing() {
        Clip clip = clip(10, null, 100);
        assertEquals(10, ClipExportService.frameTime(clip, new SingleFrameExportRequest("middle", null)));
    }

    @Test
    void frameMiddleUsesIntervalMiddle() {
        Clip clip = clip(10, 30.0, 100);
        assertEquals(20, ClipExportService.frameTime(clip, new SingleFrameExportRequest("middle", null)));
    }

    @Test
    void customRequiresTime() {
        assertThrows(IllegalArgumentException.class,
                () -> ClipExportService.frameTime(clip(10, 30.0, 100), new SingleFrameExportRequest("custom", null)));
    }

    @Test
    void sequenceCountRoundsUpAndKeepsOneFrame() {
        assertEquals(28, ClipExportService.sequenceFrameCount(28, 1));
        assertEquals(14, ClipExportService.sequenceFrameCount(28, 2));
        assertEquals(6, ClipExportService.sequenceFrameCount(28, 5));
        assertEquals(1, ClipExportService.sequenceFrameCount(0.1, 5));
    }

    @Test
    void invalidSequenceIntervalIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new SequenceFrameExportRequest(3).interval());
    }

    private static Clip clip(double start, Double end, double duration) {
        Clip clip = new Clip();
        clip.setTimestampSec(start);
        clip.setEndSec(end);
        clip.setVideoDuration(duration);
        return clip;
    }
}
