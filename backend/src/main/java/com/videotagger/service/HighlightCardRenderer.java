package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.HighlightProjectItem;
import com.videotagger.entity.Media;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.TagMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class HighlightCardRenderer {
    private final MediaMapper mediaMapper;
    private final ClipMapper clipMapper;
    private final EpisodeMapper episodeMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final TagMapper tagMapper;
    private final HighlightProperties properties;
    private final HighlightPaths paths;
    private final Path coverDir;

    public HighlightCardRenderer(MediaMapper mediaMapper, ClipMapper clipMapper, EpisodeMapper episodeMapper,
                                 ExternalWorkMapper externalWorkMapper, TagMapper tagMapper,
                                 HighlightProperties properties,
                                 @Value("${videotagger.cover-dir:data/covers}") String coverDir) {
        this.mediaMapper = mediaMapper;
        this.clipMapper = clipMapper;
        this.episodeMapper = episodeMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.tagMapper = tagMapper;
        this.properties = properties;
        this.paths = new HighlightPaths(properties);
        this.coverDir = Path.of(coverDir).toAbsolutePath().normalize();
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
                : scene.type().equals("chapter-card") ? chapter(items, scene.itemId())
                : scene.type().equals("transition") ? "" : opening(media, mediaId, title);
        String fontSize = scene.type().equals("caption-card") ? "42" : scene.type().equals("opening-card") ? "34" : "46";
        String color = scene.type().equals("caption-card") ? "0xff4d8d" : "0xffffff";
        Path cover = coverFile(media);
        boolean useCover = cover != null && ("opening-card".equals(scene.type()) || "ending-card".equals(scene.type()));
        String draw = text.isBlank() ? "" : ",drawtext=text='" + escape(text) + "':fontcolor=" + color + ":fontsize=" + fontSize + ":x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=12";
        String filter;
        List<String> command = new ArrayList<>(List.of(properties.getFfmpegPath(), "-y"));
        if (useCover) {
            command.addAll(List.of("-loop", "1", "-i", cover.toString(), "-f", "lavfi", "-i",
                    "color=c=0x090912:s=" + width + "x" + height + ",format=yuv420p"));
            filter = "[0:v]scale=" + width + ":" + height + ":force_original_aspect_ratio=decrease[cover];"
                    + "[1:v][cover]overlay=(W-w)/2:(H-h)/2" + draw + "[v]";
        } else {
            command.addAll(List.of("-f", "lavfi", "-i", "color=c=0x090912:s=" + width + "x" + height + ",format=yuv420p"));
            filter = "[0:v]null" + draw + "[v]";
        }
        int audioInput = useCover ? 2 : 1;
        command.addAll(List.of("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-filter_complex", filter,
                "-t", String.format(Locale.ROOT, "%.3f", scene.durationMs() / 1000.0),
                "-map", "[v]", "-map", audioInput + ":a:0", "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", "-pix_fmt", "yuv420p", temp.toString()));
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

    private Path coverFile(Media media) {
        if (media == null || media.getCoverPath() == null || !media.getCoverPath().startsWith("/covers/")) return null;
        Path path = coverDir.resolve(media.getCoverPath().substring("/covers/".length())).normalize();
        return path.startsWith(coverDir) && Files.isRegularFile(path) ? path : null;
    }

    private String opening(Media media, long mediaId, String title) {
        StringBuilder text = new StringBuilder(title);
        if (media != null && media.getYear() != null) text.append("\\n").append(media.getYear());
        if (media != null && media.getSeason() != null && media.getSeason() > 1) text.append(" · 第").append(media.getSeason()).append("季");
        try {
            ExternalWork work = externalWorkMapper.listByMedia(mediaId).stream()
                    .filter(w -> w.getDescription() != null && !w.getDescription().isBlank()).findFirst().orElse(null);
            if (work != null) text.append("\\n").append(shorten(work.getDescription(), 90));
        } catch (RuntimeException ignored) { }
        try {
            String tags = tagMapper.countByMedia(mediaId).stream().limit(5)
                    .map(TagUsage::name).filter(java.util.Objects::nonNull).collect(Collectors.joining(" · "));
            if (!tags.isBlank()) text.append("\\n").append(tags);
        } catch (RuntimeException ignored) { }
        return text.toString();
    }

    private String chapter(List<HighlightProjectItem> items, Long itemId) {
        HighlightProjectItem item = items.stream().filter(i -> i.getId().equals(itemId)).findFirst().orElse(null);
        if (item == null || item.getClipId() == null) return "章节";
        try {
            Clip clip = clipMapper.selectById(item.getClipId());
            Episode episode = clip == null || clip.getEpisodeId() == null ? null : episodeMapper.selectById(clip.getEpisodeId());
            return episode == null || episode.getEpisodeNo() == null ? "章节" : "第 " + episode.getEpisodeNo() + " 集";
        } catch (RuntimeException e) {
            return "章节";
        }
    }

    private String caption(List<HighlightProjectItem> items, Long itemId) {
        HighlightProjectItem item = items.stream().filter(i -> i.getId().equals(itemId)).findFirst().orElse(null);
        if (item == null) return "高光片段";
        String label = item.getCaption();
        try {
            Clip clip = item.getClipId() == null ? null : clipMapper.selectById(item.getClipId());
            Episode episode = clip == null || clip.getEpisodeId() == null ? null : episodeMapper.selectById(clip.getEpisodeId());
            if (label == null || label.isBlank()) label = clip == null ? "高光片段" : clip.getTitle();
            if (label == null || label.isBlank()) label = "高光片段";
            return episode == null || episode.getEpisodeNo() == null
                    ? label : "第 " + episode.getEpisodeNo() + " 集 · " + label;
        } catch (RuntimeException e) {
            return label == null || label.isBlank() ? "高光片段" : label;
        }
    }

    private static String shorten(String text, int max) {
        String value = text.replaceAll("\\s+", " ").trim();
        return value.length() <= max ? value : value.substring(0, Math.max(0, max - 1)) + "…";
    }

    private static String escape(String text) {
        return text == null ? "" : text.replace("\\", "\\\\").replace("'", "\\'")
                .replace(":", "\\:").replace(",", "\\,").replace(";", "\\;")
                .replace("%", "\\%").replace("[", "\\[").replace("]", "\\]");
    }

    private static String tail(String text) {
        if (text == null || text.isBlank()) return "无输出";
        return text.length() <= 800 ? text : text.substring(text.length() - 800);
    }
}
