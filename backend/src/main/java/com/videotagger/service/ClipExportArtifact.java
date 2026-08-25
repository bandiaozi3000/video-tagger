package com.videotagger.service;

public record ClipExportArtifact(String type, String url, String fileName, long size, long modifiedAt,
                                 int count, String source) {
    public ClipExportArtifact(String type, String url, String fileName, long size, long modifiedAt) {
        this(type, url, fileName, size, modifiedAt, 0, null);
    }
}
