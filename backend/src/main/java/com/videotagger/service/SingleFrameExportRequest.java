package com.videotagger.service;

public record SingleFrameExportRequest(String strategy, Double timeSec) {
    public SingleFrameExportRequest {
        strategy = strategy == null || strategy.isBlank() ? "middle" : strategy.toLowerCase();
    }
}
