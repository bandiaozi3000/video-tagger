package com.videotagger.controller;

import com.videotagger.service.SettingsDTO;
import com.videotagger.service.SettingsRequest;
import com.videotagger.service.SettingsService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** 站点设置：背景图轮播配置读取 / 保存 / 上传 / 移除。 */
@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settings;

    public SettingsController(SettingsService settings) {
        this.settings = settings;
    }

    @GetMapping
    public SettingsDTO get() {
        return settings.getSettings();
    }

    @PutMapping
    public SettingsDTO save(@RequestBody SettingsRequest req) {
        return settings.saveSettings(req);
    }

    @PostMapping("/bg")
    public SettingsDTO upload(@RequestParam("files") MultipartFile[] files) {
        return settings.addBgImages(files);
    }

    @DeleteMapping("/bg/{fileName}")
    public SettingsDTO remove(@PathVariable String fileName) {
        return settings.removeBgImage(fileName);
    }
}
