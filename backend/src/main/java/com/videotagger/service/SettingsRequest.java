package com.videotagger.service;

/** 保存站点设置请求：只更新轮播/透明度/模糊参数（图片列表由上传/删除维护）。 */
public record SettingsRequest(Integer rotationSec, Double opacity, Integer blur) {
}
