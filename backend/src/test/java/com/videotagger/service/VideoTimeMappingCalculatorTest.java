package com.videotagger.service;

import com.videotagger.entity.VideoTimeMappingAnchor;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class VideoTimeMappingCalculatorTest {
    @Test void oneAnchorUsesFixedOffset() { var a = anchor(1, 1000, 1250); var result = VideoTimeMappingCalculator.calculate(List.of(a), 50); assertEquals("AUTO_ESTIMATED", result.state()); assertEquals(250L, result.offsetMs()); }
    @Test void twoAnchorsDetectLinearDrift() { var result = VideoTimeMappingCalculator.calculate(List.of(anchor(1, 0, 100), anchor(2, 1000, 1120)), 50); assertEquals("DRIFT_DETECTED", result.state()); assertEquals(0.02d, result.driftRatio(), 0.0001); }
    @Test void nonLinearAnchorsAreIncompatible() { var result = VideoTimeMappingCalculator.calculate(List.of(anchor(1, 0, 0), anchor(2, 1000, 1000), anchor(3, 2000, 2500)), 50); assertEquals("INCOMPATIBLE", result.state()); }
    @Test void assetPathIgnoresUnsafeExtensionCharacters() { assertEquals(Path.of("data/media-1/entry-2/episode-3/asset-4.mp4"), VideoAssetPathService.assetPath(Path.of("data"), 1, 2, 3, 4, ".MP4")); assertTrue(VideoAssetPathService.temporaryPath(Path.of("data/a.mp4")).toString().endsWith("a.mp4.part")); }
    private static VideoTimeMappingAnchor anchor(int order, long oldMs, long newMs) { var a = new VideoTimeMappingAnchor(); a.setSortOrder(order); a.setOldTimeMs(oldMs); a.setNewTimeMs(newMs); return a; }
}