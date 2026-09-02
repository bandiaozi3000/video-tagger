package com.videotagger.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * v0.24 G6：前端 UI 功能开关。v0.23 自建播放/片源 UI 默认隐藏（Animeko 接管播放前台），
 * 引擎层保留，仅从主入口收起。env VT_SHOW_V023_PLAYER=true 可恢复旧播放工作台。
 */
@RestController
@RequestMapping("/api/app/ui-config")
public class UiConfigController {

    private final Map<String, Object> config;

    public UiConfigController(@Value("${videotagger.ui.show-v023-player:false}") boolean showV023Player) {
        this.config = Map.of("showV023Player", showV023Player);
    }

    @GetMapping
    public Map<String, Object> get() {
        return config;
    }
}
