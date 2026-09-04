package com.videotagger.videosource.torrent;

import java.util.List;

/** 解析后的种子标题结构化信息（v0.25 D1：排序所需特征来自 RSS 标题解析）。 */
public record TorrentTitleInfo(
        String rawTitle,
        /** 发布组（首个括号前缀，如 [SubsPlease] / 【爱恋字幕社】 / (GJM)） */
        String group,
        /** 发布来源：BDRip / WEB-DL / Remux / RAW …（未识别为 null） */
        String releaseSource,
        /** 分辨率显示串：1080p / 720p / 4K …（未识别为 null） */
        String resolution,
        /** 编码：x264 / x265 / AV1 …（未识别为 null） */
        String codec,
        /** 语种/字幕线索：简日 / 双语 / Multi-Subs …（未识别为 null） */
        String languageHint,
        /** 单集号列表（合集包/未识别为空表） */
        List<Integer> episodes,
        /** 是否合集包（Batch / 全集 / 集数区间 [01-12]）——v1 标灰排除对象 */
        boolean batch,
        /** 标题去噪后的作品名粗判（供人读，不做精确匹配） */
        String mediaTitle) {
}
