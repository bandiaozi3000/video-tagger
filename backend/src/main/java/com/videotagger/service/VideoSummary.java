package com.videotagger.service;

/** 视频列表聚合项：一个视频 = 同一 video_fp 的一组标签 */
public record VideoSummary(String fp, long count, long latest, String title) {
}
