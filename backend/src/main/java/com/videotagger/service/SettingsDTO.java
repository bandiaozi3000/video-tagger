package com.videotagger.service;

import java.util.ArrayList;
import java.util.List;

/** 站点设置 DTO：背景图列表（URL）+ 轮换时间/透明度/模糊参数。 */
public record SettingsDTO(List<String> bgImages, Integer rotationSec, Double opacity, Integer blur) {

    public static SettingsDTO defaults() {
        return new SettingsDTO(new ArrayList<>(), 15, 0.6, 30);
    }
}
