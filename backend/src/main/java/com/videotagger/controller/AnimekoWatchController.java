package com.videotagger.controller;

import com.videotagger.service.AnimekoWatchImportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** v0.24 Animeko 观看事实导入：状态预览 + 手动导入。 */
@RestController
@RequestMapping("/api/animeko/watch")
public class AnimekoWatchController {

    private final AnimekoWatchImportService service;

    public AnimekoWatchController(AnimekoWatchImportService service) {
        this.service = service;
    }

    /** Animeko DB 可达性 + 有效播放记录数预览（不写库）。 */
    @GetMapping("/status")
    public AnimekoWatchImportService.Status status() {
        return service.status();
    }

    /** 把最近播放历史按 Bangumi id 桥映射回本地 Episode 并标记 watchedAt。 */
    @PostMapping("/import")
    public AnimekoWatchImportService.ImportResult importWatchHistory() {
        return service.importWatchHistory();
    }
}
