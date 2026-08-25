package com.videotagger.service;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Component
public class LocalVideoResolver {
    private final ClipExportProperties properties;
    private final Path videoDir;

    public LocalVideoResolver(ClipExportProperties properties) {
        this.properties = properties;
        this.videoDir = Paths.get(properties.getVideoDir()).toAbsolutePath().normalize();
    }

    public Path resolve(String videoFp) {
        if (videoFp == null || !videoFp.matches("[A-Za-z0-9_-]+")) {
            throw new IllegalArgumentException("片段没有有效的视频指纹");
        }
        List<Path> matches = new ArrayList<>();
        for (String extension : properties.getAllowedExtensions()) {
            String ext = extension == null ? "" : extension.trim().toLowerCase();
            if (ext.isEmpty() || !ext.matches("[a-z0-9]+")) {
                continue;
            }
            Path candidate = videoDir.resolve(videoFp + "." + ext).normalize();
            if (!candidate.startsWith(videoDir)) {
                throw new IllegalArgumentException("视频路径越界");
            }
            if (Files.isRegularFile(candidate, LinkOption.NOFOLLOW_LINKS)) {
                matches.add(candidate);
            }
        }
        if (matches.isEmpty()) {
            throw new IllegalArgumentException("找不到本地源视频，请将文件放入 data/videos 并命名为 videoFp.扩展名");
        }
        if (matches.size() > 1) {
            throw new IllegalArgumentException("同一视频指纹匹配到多个源文件，请只保留一个");
        }
        return matches.get(0);
    }

    public Path videoDir() {
        return videoDir;
    }
}
