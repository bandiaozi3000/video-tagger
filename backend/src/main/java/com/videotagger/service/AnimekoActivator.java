package com.videotagger.service;

import com.videotagger.util.AnimekoPaths;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * v0.24 Animeko 桌面端激活/置前：Animeko 无深链协议，无法精确定位到集/秒，
 * 只能唤起窗口置前（已运行 → 单实例 Mutex 触发 showWindowByName；未运行 → 启动）。
 * 前端据此给出"请在 Animeko 中打开该集"提示。
 */
@Service
public class AnimekoActivator {

    private static final Logger log = LoggerFactory.getLogger(AnimekoActivator.class);

    private final String exePath;

    public AnimekoActivator(@Value("${videotagger.animeko.exe-path:}") String exePath) {
        this.exePath = AnimekoPaths.resolveExe(exePath);
    }

    /** Animeko 是否可达（exe 已探测到）。 */
    public boolean available() {
        return exePath != null && !exePath.isBlank() && Files.isRegularFile(Path.of(exePath));
    }

    /** 唤起 Animeko 窗口置前（运行中则激活；未运行则启动），返回可展示状态。 */
    public ActivateResult activate() {
        if (!available()) {
            return new ActivateResult(false, null,
                    "未找到 Animeko（可配置 videotagger.animeko.exe-path 指向 Ani.exe）");
        }
        try {
            // Animeko 单实例：二次启动会由 WindowsSingleInstanceChecker 触发窗口置前后退出，进程退出码不影响前端。
            ProcessBuilder pb = new ProcessBuilder(List.of(exePath));
            pb.redirectErrorStream(true);
            Process p = pb.start();
            // 给单实例检查一点点时间（Mutex 分支会自行退出），不等它结束，避免 GUI 实例被我们阻塞
            return new ActivateResult(true, exePath,
                    "已唤起 Animeko（Animeko 不支持外部定位，请在弹出的 Animeko 窗口打开目标番剧/集）");
        } catch (Exception e) {
            log.warn("[animeko-activate] 启动失败: {}", e.getMessage());
            return new ActivateResult(false, exePath, "启动 Animeko 失败: " + e.getMessage());
        }
    }

    public record ActivateResult(boolean ok, String exePath, String message) {
    }
}
