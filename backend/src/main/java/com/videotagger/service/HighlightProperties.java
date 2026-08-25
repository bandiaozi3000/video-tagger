package com.videotagger.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "videotagger.highlight")
public class HighlightProperties {
    private String rootDir = "data/highlight-projects";
    private String styleDir = "data/highlight-styles";
    private String ffmpegPath = "ffmpeg";
    private long taskTimeoutSec = 3600;
    private long maxUploadBytes = 500L * 1024 * 1024;
    private long maxDownloadBytes = 500L * 1024 * 1024;
    private double maxDurationSec = 7200;
    private int maxItems = 200;
    private List<String> allowedVideoExtensions = new ArrayList<>(List.of("mp4", "mkv", "webm", "mov", "avi", "flv"));
    private List<String> allowedAudioExtensions = new ArrayList<>(List.of("mp3", "m4a", "wav", "ogg"));

    public String getRootDir() { return rootDir; }
    public void setRootDir(String rootDir) { this.rootDir = rootDir; }
    public String getStyleDir() { return styleDir; }
    public void setStyleDir(String styleDir) { this.styleDir = styleDir; }
    public String getFfmpegPath() { return ffmpegPath; }
    public void setFfmpegPath(String ffmpegPath) { this.ffmpegPath = ffmpegPath; }
    public long getTaskTimeoutSec() { return taskTimeoutSec; }
    public void setTaskTimeoutSec(long taskTimeoutSec) { this.taskTimeoutSec = taskTimeoutSec; }
    public long getMaxUploadBytes() { return maxUploadBytes; }
    public void setMaxUploadBytes(long maxUploadBytes) { this.maxUploadBytes = maxUploadBytes; }
    public long getMaxDownloadBytes() { return maxDownloadBytes; }
    public void setMaxDownloadBytes(long maxDownloadBytes) { this.maxDownloadBytes = maxDownloadBytes; }
    public double getMaxDurationSec() { return maxDurationSec; }
    public void setMaxDurationSec(double maxDurationSec) { this.maxDurationSec = maxDurationSec; }
    public int getMaxItems() { return maxItems; }
    public void setMaxItems(int maxItems) { this.maxItems = maxItems; }
    public List<String> getAllowedVideoExtensions() { return allowedVideoExtensions; }
    public void setAllowedVideoExtensions(List<String> allowedVideoExtensions) { this.allowedVideoExtensions = allowedVideoExtensions; }
    public List<String> getAllowedAudioExtensions() { return allowedAudioExtensions; }
    public void setAllowedAudioExtensions(List<String> allowedAudioExtensions) { this.allowedAudioExtensions = allowedAudioExtensions; }
}
