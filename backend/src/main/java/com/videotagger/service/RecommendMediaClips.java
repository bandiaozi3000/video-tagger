package com.videotagger.service;

import java.util.List;

/** 推荐中某一媒体挂载的真实片段及其播放角标配置。 */
public record RecommendMediaClips(List<Long> order, Badge badge) {

    public record Badge(Boolean mediaTitle, Boolean clipTitle, Boolean index, Boolean note, String custom) {
    }
}
