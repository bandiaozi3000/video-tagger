package com.videotagger.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "videotagger.clip-export")
public class ClipExportProperties {
    private String videoDir = "data/videos";
    private String videoOutputDir = "data/clip-videos";
    private String imageOutputDir = "data/clip-images";
    private double maxDurationSec = 1800;
    private long taskTimeoutSec = 3600;
    private String ffmpegPath = "ffmpeg";
    private long browserMaxSizeBytes = 200L * 1024 * 1024;
    private int maxSequenceFrames = 300;
    private List<String> allowedExtensions = new ArrayList<>(List.of("mp4", "mkv", "webm", "mov", "avi", "flv"));

    public String getVideoDir() { return videoDir; }
    public void setVideoDir(String videoDir) { this.videoDir = videoDir; }
    public String getVideoOutputDir() { return videoOutputDir; }
    public void setVideoOutputDir(String videoOutputDir) { this.videoOutputDir = videoOutputDir; }
    public String getImageOutputDir() { return imageOutputDir; }
    public void setImageOutputDir(String imageOutputDir) { this.imageOutputDir = imageOutputDir; }
    public double getMaxDurationSec() { return maxDurationSec; }
    public void setMaxDurationSec(double maxDurationSec) { this.maxDurationSec = maxDurationSec; }
    public long getTaskTimeoutSec() { return taskTimeoutSec; }
    public void setTaskTimeoutSec(long taskTimeoutSec) { this.taskTimeoutSec = taskTimeoutSec; }
    public String getFfmpegPath() { return ffmpegPath; }
    public void setFfmpegPath(String ffmpegPath) { this.ffmpegPath = ffmpegPath; }
    public long getBrowserMaxSizeBytes() { return browserMaxSizeBytes; }
    public void setBrowserMaxSizeBytes(long browserMaxSizeBytes) { this.browserMaxSizeBytes = browserMaxSizeBytes; }
    public int getMaxSequenceFrames() { return maxSequenceFrames; }
    public void setMaxSequenceFrames(int maxSequenceFrames) { this.maxSequenceFrames = maxSequenceFrames; }
    public List<String> getAllowedExtensions() { return allowedExtensions; }
    public void setAllowedExtensions(List<String> allowedExtensions) { this.allowedExtensions = allowedExtensions; }
}
