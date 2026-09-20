package com.videotagger.service;

import java.util.List;
import java.util.Map;

/**
 * 推荐中某一媒体挂载的真实片段及其播放角标配置。
 *
 * `sources` 是**跨媒体借片段**的来源映射（clipId → 来源 mediaId），可选：
 * 缺省 / 不含该 clipId = 本体片段，行为与升级前完全一致（旧草稿无需迁移）。
 * 设计规格：docs/superpowers/specs/2026-09-20-cross-media-clip-source-design.md
 */
public record RecommendMediaClips(List<Long> order, Badge badge, Map<Long, Long> sources) {

    /** 兼容两参构造（旧的调用方/测试）——sources 为空 = 全部本体。 */
    public RecommendMediaClips(List<Long> order, Badge badge) {
        this(order, badge, Map.of());
    }

    /** 该片段是不是借来的（非本体）。 */
    public Long sourceOf(Long clipId) {
        return sources == null ? null : sources.get(clipId);
    }

    public record Badge(Boolean mediaTitle, Boolean clipTitle, Boolean index, Boolean note, String custom) {
    }
}
