package com.videotagger.service;

public record ClipExportTask(long id, long clipId, String type, String status, String message,
                             String artifactUrl, long createdAt, long finishedAt,
                             int progress, int total, String phase, String source) {
    public ClipExportTask(long id, long clipId, String type, String status, String message,
                          String artifactUrl, long createdAt, long finishedAt) {
        this(id, clipId, type, status, message, artifactUrl, createdAt, finishedAt,
                0, 0, null, null);
    }

    public boolean active() {
        return "PENDING".equals(status) || "RUNNING".equals(status);
    }
}
