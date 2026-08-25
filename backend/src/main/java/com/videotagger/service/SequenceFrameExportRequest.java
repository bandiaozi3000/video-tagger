package com.videotagger.service;

public record SequenceFrameExportRequest(Integer intervalSec) {
    public int interval() {
        int value = intervalSec == null ? 1 : intervalSec;
        if (value != 1 && value != 2 && value != 5) {
            throw new IllegalArgumentException("连续截图间隔只能是 1、2 或 5 秒");
        }
        return value;
    }
}
