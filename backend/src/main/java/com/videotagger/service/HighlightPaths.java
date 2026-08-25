package com.videotagger.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

final class HighlightPaths {
    private final Path root;

    HighlightPaths(HighlightProperties properties) {
        this.root = Path.of(properties.getRootDir()).toAbsolutePath().normalize();
    }

    Path projectRoot(long projectId) {
        return underRoot(root.resolve(Long.toString(projectId)));
    }

    Path source(long projectId, long itemId) {
        return underProject(projectId, "sources", itemId + ".mp4");
    }

    Path upload(long projectId, long itemId, String extension) {
        return underProject(projectId, "uploads", itemId + "." + extension);
    }

    Path bgm(long projectId, String extension) {
        return underProject(projectId, "audio", "bgm." + extension);
    }

    Path normalized(long projectId, long exportId, long itemId) {
        return underProject(projectId, "normalized", exportId + "-" + itemId + ".mp4");
    }

    Path card(long projectId, long exportId, String name) {
        return underProject(projectId, "cards", exportId + "-" + name + ".mp4");
    }

    Path export(long projectId, long exportId) {
        return underProject(projectId, "exports", exportId + ".mp4");
    }

    Path fromStoredPath(long projectId, String storedPath) {
        if (storedPath == null || storedPath.isBlank()) throw new IllegalArgumentException("素材路径不存在");
        Path project = projectRoot(projectId);
        Path path = project.resolve(storedPath).normalize();
        if (!path.startsWith(project)) throw new IllegalArgumentException("素材路径越界");
        return path;
    }

    String store(long projectId, Path path) {
        Path project = projectRoot(projectId);
        Path normalized = underRoot(path.toAbsolutePath().normalize());
        if (!normalized.startsWith(project)) throw new IllegalArgumentException("素材路径越界");
        return project.relativize(normalized).toString().replace('\\', '/');
    }

    void ensureParent(Path path) throws IOException {
        Files.createDirectories(path.getParent());
    }

    private Path underProject(long projectId, String directory, String file) {
        return underRoot(projectRoot(projectId).resolve(directory).resolve(file));
    }

    private Path underRoot(Path path) {
        Path normalized = path.toAbsolutePath().normalize();
        if (!normalized.startsWith(root)) throw new IllegalArgumentException("高光素材路径越界");
        return normalized;
    }
}
