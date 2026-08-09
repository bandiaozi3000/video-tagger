package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.SiteSetting;
import com.videotagger.mapper.SiteSettingMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/** 站点设置服务：背景图（多图轮播）落盘 data/site/bg + 配置存 site_setting 键值表。 */
@Service
public class SettingsService {

    private static final String KEY = "site";
    private static final String BG_URL_PREFIX = "/site/bg/";

    private final SiteSettingMapper mapper;
    private final ObjectMapper json;
    private final String siteDir;

    public SettingsService(SiteSettingMapper mapper, ObjectMapper json,
                           @Value("${videotagger.site-dir:data/site}") String siteDir) {
        this.mapper = mapper;
        this.json = json;
        /* 转绝对路径：transferTo 对相对路径会落到 Tomcat 临时 work 目录，createDirectories 却建在工作目录下，两边不一致 */
        this.siteDir = Paths.get(siteDir).toAbsolutePath().toString();
    }

    public SettingsDTO getSettings() {
        SiteSetting s = mapper.selectById(KEY);
        if (s == null || s.getValue() == null || s.getValue().isBlank()) {
            return SettingsDTO.defaults();
        }
        try {
            return json.readValue(s.getValue(), SettingsDTO.class);
        } catch (Exception e) {
            return SettingsDTO.defaults();
        }
    }

    /** 保存轮播参数（图片列表保留当前）。 */
    public SettingsDTO saveSettings(SettingsRequest req) {
        SettingsDTO cur = getSettings();
        SettingsDTO next = new SettingsDTO(cur.bgImages(),
                req.rotationSec() == null ? cur.rotationSec() : req.rotationSec(),
                req.opacity() == null ? cur.opacity() : req.opacity(),
                req.blur() == null ? cur.blur() : req.blur());
        persist(next);
        return next;
    }

    /** 追加背景图（multipart 多张）落盘并更新配置。 */
    public SettingsDTO addBgImages(MultipartFile[] files) {
        SettingsDTO cur = getSettings();
        List<String> bgImages = new ArrayList<>(cur.bgImages());
        Path bgDir = Paths.get(siteDir, "bg");
        try {
            Files.createDirectories(bgDir);
            for (MultipartFile f : files) {
                if (f == null || f.isEmpty()) {
                    continue;
                }
                String name = System.currentTimeMillis() + "_" + sanitize(f.getOriginalFilename());
                f.transferTo(bgDir.resolve(name).toFile());
                bgImages.add(BG_URL_PREFIX + name);
            }
        } catch (IOException e) {
            throw new RuntimeException("背景图保存失败: " + e.getMessage(), e);
        }
        SettingsDTO next = new SettingsDTO(bgImages, cur.rotationSec(), cur.opacity(), cur.blur());
        persist(next);
        return next;
    }

    /** 移除单张背景图（白名单校验文件名防目录穿越，同步删文件）。 */
    public SettingsDTO removeBgImage(String fileName) {
        String clean = Paths.get(fileName).getFileName().toString();
        if (!clean.equals(fileName) || clean.isBlank() || clean.contains("..")) {
            throw new IllegalArgumentException("非法文件名");
        }
        SettingsDTO cur = getSettings();
        List<String> bgImages = new ArrayList<>(cur.bgImages());
        bgImages.remove(BG_URL_PREFIX + clean);
        try {
            Files.deleteIfExists(Paths.get(siteDir, "bg", clean));
        } catch (IOException ignored) {
        }
        SettingsDTO next = new SettingsDTO(bgImages, cur.rotationSec(), cur.opacity(), cur.blur());
        persist(next);
        return next;
    }

    private void persist(SettingsDTO dto) {
        try {
            String v = json.writeValueAsString(dto);
            SiteSetting s = mapper.selectById(KEY);
            if (s == null) {
                s = new SiteSetting();
                s.setSkey(KEY);
                s.setValue(v);
                mapper.insert(s);
            } else {
                s.setValue(v);
                mapper.updateById(s);
            }
        } catch (Exception e) {
            throw new RuntimeException("设置保存失败", e);
        }
    }

    private static String sanitize(String name) {
        if (name == null || name.isBlank()) {
            return "bg.jpg";
        }
        return name.replaceAll("[\\\\/:*?\"<>|\\s]+", "_");
    }
}
