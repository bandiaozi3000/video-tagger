package com.videotagger.service;

import com.videotagger.entity.VideoTimeMappingAnchor;

import java.util.Comparator;
import java.util.List;

public final class VideoTimeMappingCalculator {
    private VideoTimeMappingCalculator() {}

    public record Result(String state, Long offsetMs, Double driftRatio, Double confidence, String reason) {}

    public static Result calculate(List<VideoTimeMappingAnchor> rawAnchors, long toleranceMs) {
        List<VideoTimeMappingAnchor> anchors = rawAnchors == null ? List.of() : rawAnchors.stream().filter(a -> a != null && a.getOldTimeMs() != null && a.getNewTimeMs() != null).sorted(Comparator.comparing(VideoTimeMappingAnchor::getOldTimeMs)).toList();
        if (anchors.isEmpty()) return new Result("UNMAPPED", null, null, 0d, "NO_ANCHORS");
        if (anchors.size() == 1) { long offset = anchors.get(0).getNewTimeMs() - anchors.get(0).getOldTimeMs(); return new Result("AUTO_ESTIMATED", offset, 0d, confidence(anchors), "FIXED_OFFSET"); }
        VideoTimeMappingAnchor first = anchors.get(0), last = anchors.get(anchors.size() - 1);
        long oldSpan = last.getOldTimeMs() - first.getOldTimeMs();
        if (oldSpan <= 0) return new Result("INCOMPATIBLE", null, null, 0d, "DUPLICATE_ANCHOR_TIME");
        double slope = (double)(last.getNewTimeMs() - first.getNewTimeMs()) / oldSpan;
        double intercept = first.getNewTimeMs() - slope * first.getOldTimeMs();
        double maxResidual = anchors.stream().mapToDouble(a -> Math.abs((slope * a.getOldTimeMs() + intercept) - a.getNewTimeMs())).max().orElse(Double.POSITIVE_INFINITY);
        if (maxResidual > Math.max(1, toleranceMs)) return new Result("INCOMPATIBLE", null, null, Math.max(0d, 1d - maxResidual / (maxResidual + 1000d)), "NON_LINEAR_EDIT");
        long offset = Math.round(intercept);
        return new Result("DRIFT_DETECTED", offset, slope - 1d, confidence(anchors), "LINEAR_MAPPING");
    }

    private static double confidence(List<VideoTimeMappingAnchor> anchors) { return Math.min(1d, 0.5d + anchors.size() * 0.15d); }
}