package com.videotagger.util;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Animeko 桌面端本地库定位。优先取显式配置（videotagger.animeko.db-path / ANIMEKO_DB_PATH），
 * 为空时自动探测 Windows 标准路径（%USERPROFILE%\AppData\Roaming\Him188\Ani\data\），
 * 命中返回绝对路径，未命中返回空串（=功能关闭）。
 */
public final class AnimekoPaths {

    private AnimekoPaths() {
    }

    public static String resolve(String configured) {
        if (configured != null && !configured.isBlank()) {
            return configured.trim();
        }
        try {
            String home = System.getProperty("user.home");
            if (home != null && !home.isBlank()) {
                Path candidate = Path.of(home, "AppData", "Roaming", "Him188", "Ani", "data",
                        "ani_room_database_main.db");
                if (Files.isRegularFile(candidate)) {
                    return candidate.toString();
                }
            }
        } catch (Exception ignored) {
            // 探测失败按未配置处理
        }
        return "";
    }
}
