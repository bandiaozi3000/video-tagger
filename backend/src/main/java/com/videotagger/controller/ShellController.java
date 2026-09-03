package com.videotagger.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.awt.Desktop;
import java.io.File;
import java.util.Map;

/**
 * v0.24.1 本机外壳操作（浏览器/无 Electron 壳时兜底桌面能力）。
 * 仅限本机应用语义：校验绝对路径 + 文件存在后，调系统资源管理器定位/打开目录。
 */
@RestController
@RequestMapping("/api/shell")
public class ShellController {

    @PostMapping("/open-folder")
    public Map<String, Object> openFolder(@RequestBody Map<String, String> body) {
        String p = body == null ? null : body.get("path");
        if (p == null || p.isBlank()) return Map.of("ok", false, "message", "路径为空");
        File f = new File(p);
        if (!f.isAbsolute() || !f.exists()) return Map.of("ok", false, "message", "路径不存在或非法：" + p);
        try {
            String os = System.getProperty("os.name", "").toLowerCase();
            if (os.contains("win")) {
                if (f.isDirectory()) {
                    new ProcessBuilder("explorer.exe", p).start();
                } else {
                    new ProcessBuilder("explorer.exe", "/select," + p).start();
                }
            } else if (f.isDirectory()) {
                Desktop.getDesktop().open(f);
            } else {
                File parent = f.getParentFile();
                if (parent != null) Desktop.getDesktop().open(parent);
            }
            return Map.of("ok", true);
        } catch (Exception e) {
            return Map.of("ok", false, "message", String.valueOf(e.getMessage()));
        }
    }
}
