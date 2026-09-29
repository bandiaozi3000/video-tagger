package com.videotagger.util;

import org.springframework.http.MediaType;

import java.io.File;
import java.io.FileInputStream;
import java.util.Locale;

/**
 * 本地文件 → 播放用 MIME。两处「本地回顾」播放端点（集 / 片段）共用，别各写一份扩展名表。
 *
 * <p>扩展名不认识时**按文件头嗅探**：offset 4 起为 {@code ftyp} = ISO BMFF（mp4/m4v 内核）。
 * B 站下载器产出的 {@code .flv} 正是这种「伪扩展名」（2026-09-29 实测：major_brand=isom、
 * H.264 High + AAC、浏览器本来就能播），别让扩展名把它挡在 409 门外。
 * 真 flv 容器（头 3 字节 {@code FLV}）嗅不出来 → 返回 {@code null}，调用方照旧 409 —— 不假装能播。
 */
public final class VideoMimeTypes {

    private VideoMimeTypes() {}

    /** 先按扩展名，认不出再嗅探；都不认 → null。 */
    public static MediaType of(File file) {
        if (file == null) return null;
        String name = file.getName().toLowerCase(Locale.ROOT);
        if (name.endsWith(".mp4")) return MediaType.parseMediaType("video/mp4");
        if (name.endsWith(".webm")) return MediaType.parseMediaType("video/webm");
        if (name.endsWith(".mkv")) return MediaType.parseMediaType("video/x-matroska");
        if (name.endsWith(".mov")) return MediaType.parseMediaType("video/quicktime");
        if (name.endsWith(".ts")) return MediaType.parseMediaType("video/mp2t");
        if (name.endsWith(".m4v")) return MediaType.parseMediaType("video/x-m4v");
        return sniffIsoBmff(file);
    }

    /** ISO BMFF 头：box size(4B) + "ftyp"。读失败或文件不足 8 字节 → null。 */
    private static MediaType sniffIsoBmff(File file) {
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] head = in.readNBytes(8);
            if (head.length == 8
                    && head[4] == 'f' && head[5] == 't' && head[6] == 'y' && head[7] == 'p') {
                return MediaType.parseMediaType("video/mp4");
            }
        } catch (Exception ignored) {
        }
        return null;
    }
}
