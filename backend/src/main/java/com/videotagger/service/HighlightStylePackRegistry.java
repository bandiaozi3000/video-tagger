package com.videotagger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class HighlightStylePackRegistry {
    private static final Pattern ID = Pattern.compile("[a-z0-9][a-z0-9._-]{0,63}");
    private static final long MAX_PACK_BYTES = 100_000;
    private final ObjectMapper objectMapper;
    private final Path styleDir;

    public HighlightStylePackRegistry(ObjectMapper objectMapper, HighlightProperties properties) {
        this.objectMapper = objectMapper;
        this.styleDir = Path.of(properties.getStyleDir()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(styleDir);
        } catch (IOException e) {
            throw new IllegalStateException("无法创建高光风格目录：" + styleDir, e);
        }
    }

    public List<String> ids() {
        if (!Files.isDirectory(styleDir)) return List.of();
        try (var stream = Files.list(styleDir)) {
            return stream.filter(path -> path.getFileName().toString().endsWith(".json"))
                    .map(path -> path.getFileName().toString().replaceFirst("\\.json$", ""))
                    .filter(name -> ID.matcher(name).matches()).map(String::trim).sorted().toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    public JsonNode load(String id) {
        if (id == null || !ID.matcher(id).matches()) return null;
        Path path = styleDir.resolve(id + ".json").normalize();
        if (!path.startsWith(styleDir) || !Files.isRegularFile(path)) return null;
        try {
            if (Files.size(path) > MAX_PACK_BYTES) throw new IllegalArgumentException("外部风格包过大：" + id);
            JsonNode root = objectMapper.readTree(Files.readString(path, StandardCharsets.UTF_8));
            if (root == null || !root.isObject()) throw new IllegalArgumentException("外部风格包必须是 JSON 对象：" + id);
            if (root.has("script") || root.has("shell") || root.has("rawFfmpeg")) {
                throw new IllegalArgumentException("外部风格包不允许脚本或原始命令：" + id);
            }
            return root.has("style") ? root.get("style") : root;
        } catch (IOException e) {
            throw new IllegalArgumentException("读取外部风格包失败：" + id, e);
        }
    }
}
