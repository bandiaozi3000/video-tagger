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

    /**
     * 解析 Animeko 桌面可执行文件路径。优先显式配置（videotagger.animeko.exe-path / ANIMEKO_EXE_PATH），
     * 其次取当前正在运行的 Ani 进程路径（最可靠），最后探测常见安装位。未命中返回空串。
     */
    public static String resolveExe(String configured) {
        if (configured != null && !configured.isBlank()) {
            return configured.trim();
        }
        try {
            String fromRunning = runningAniExe();
            if (fromRunning != null) return fromRunning;
        } catch (Exception ignored) {
            // 继续候选路径
        }
        String home = System.getProperty("user.home");
        if (home != null && !home.isBlank()) {
            for (String candidate : new String[]{
                    home + "\\AppData\\Local\\Programs\\Ani\\Ani.exe",
                    home + "\\AppData\\Local\\Ani\\Ani.exe",
                    home + "\\scoop\\apps\\ani\\current\\Ani.exe",
            }) {
                if (Files.isRegularFile(Path.of(candidate))) return candidate;
            }
        }
        for (String candidate : new String[]{
                "D:\\Tool\\Ani\\Ani.exe",   // 用户实测安装位
                "C:\\Program Files\\Ani\\Ani.exe",
                "C:\\Program Files (x86)\\Ani\\Ani.exe",
        }) {
            if (Files.isRegularFile(Path.of(candidate))) return candidate;
        }
        return "";
    }

    /** 查当前运行的 Ani 进程可执行路径（wmic/tasklist 解析），失败返回 null。 */
    private static String runningAniExe() {
        try {
            Process p = new ProcessBuilder("wmic", "process", "where", "name='Ani.exe'",
                    "get", "ExecutablePath", "/format:list").redirectErrorStream(true).start();
            String out = new String(p.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            p.waitFor();
            for (String line : out.split("\r?\n")) {
                if (line.startsWith("ExecutablePath=")) {
                    String path = line.substring("ExecutablePath=".length()).trim();
                    if (!path.isBlank() && Files.isRegularFile(Path.of(path))) return path;
                }
            }
        } catch (Exception ignored) {
            // 探测失败回退候选路径
        }
        return null;
    }
}
