package com.videotagger.service;

import com.videotagger.entity.Media;
import com.videotagger.entity.HighlightProjectItem;
import com.videotagger.mapper.MediaMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Service
public class HighlightCardRenderer {
    private final MediaMapper mediaMapper;
    private final HighlightProperties properties;
    private final HighlightPaths paths;

    public HighlightCardRenderer(MediaMapper mediaMapper, HighlightProperties properties) {
        this.mediaMapper = mediaMapper;
        this.properties = properties;
        this.paths = new HighlightPaths(properties);
    }

    public Path render(long projectId, long exportId, long mediaId, HighlightStyleCompiler.Scene scene,
                       int sceneIndex, List<HighlightProjectItem> items, int width, int height) throws IOException, InterruptedException {
        Path output = paths.card(projectId, exportId, scene.type() + "-" + sceneIndex);
        paths.ensureParent(output);
        Path temp = output.resolveSibling(output.getFileName() + ".part.mp4");
        Files.deleteIfExists(temp);
        Media media = mediaMapper.selectById(mediaId);
        String title = media == null || media.getTitle() == null ? "高光推荐" : media.getTitle();
        String text = scene.type().equals("caption-card") ? caption(items, scene.itemId())
                : scene.type().equals("transition") ? "" : title;
        String fontSize = scene.type().equals("caption-card") ? "42" : "56";
        String color = scene.type().equals("caption-card") ? "0xff4d8d" : "0xffffff";
        String filter = "color=c=0x090912:s=" + width + "x" + height + ",format=yuv420p";
        if (!text.isBlank()) filter += ",drawtext=text='" + escape(text) + "':fontcolor=" + color + ":fontsize=" + fontSize + ":x=(w-text_w)/2:y=(h-text_h)/2";
        List<String> command = List.of(properties.getFfmpegPath(), "-y", "-f", "lavfi", "-i", filter,
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-t", String.format(java.util.Locale.ROOT, "%.3f", scene.durationMs() / 1000.0),
                "-map", "0:v:0", "-map", "1:a:0", "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", "-pix_fmt", "yuv420p", temp.toString());
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        String logs = new String(process.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        if (!process.waitFor(properties.getTaskTimeoutSec(), java.util.concurrent.TimeUnit.SECONDS) || process.exitValue() != 0) {
            throw new IllegalStateException("视觉卡片生成失败：" + tail(logs));
        }
        if (!Files.isRegularFile(temp) || Files.size(temp) < 1024) throw new IOException("视觉卡片为空");
        try { Files.move(temp, output, java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE); }
        catch (java.nio.file.AtomicMoveNotSupportedException e) { Files.move(temp, output, java.nio.file.StandardCopyOption.REPLACE_EXISTING); }
        return output;
    }

    private static String caption(List<HighlightProjectItem> items, Long itemId) {
        return items.stream().filter(item -> item.getId().equals(itemId)).map(HighlightProjectItem::getCaption)
                .findFirst().orElse("高光片段");
    }

    private static String escape(String text) {
        return text == null ? "" : text.replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:");
    }

    private static String tail(String text) {
        if (text == null || text.isBlank()) return "无输出";
        return text.length() <= 800 ? text : text.substring(text.length() - 800);
    }
}
