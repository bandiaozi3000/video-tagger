package com.videotagger.videosource.torrent;

import java.util.List;

/** 排序候选（v0.25 D1）：解析 + 启发式分档后的不可变视图；精判复核后生成新的同候选实例。 */
public record RankedCandidate(
        String providerId,
        String itemId,
        String title,
        SubtitleTier tier,
        /** 档位依据：EXPLICIT_TOKEN / GROUP_WHITELIST / UNKNOWN / FILE_LIST(精判后) */
        String tierBasis,
        String group,
        int resolutionHeight,
        String codec,
        long bytes,
        boolean batch,
        List<Integer> episodes) {

    /** 便捷入口：标题 → 解析 + 启发式粗筛 → 候选（bytes -1 = 未知）。 */
    public static RankedCandidate fromTitle(String providerId, String itemId, String title, long bytes) {
        TorrentTitleInfo info = TorrentTitleParser.parse(title);
        SubtitleTierHeuristic.TierGuess guess = SubtitleTierHeuristic.guess(info);
        return new RankedCandidate(providerId, itemId, title, guess.tier(), guess.basis(), info.group(),
                height(info.resolution()), info.codec(), bytes, info.batch(), info.episodes());
    }

    static int height(String resolution) {
        if (resolution == null) {
            return 0;
        }
        return switch (resolution.toLowerCase(java.util.Locale.ROOT)) {
            case "4k", "2160p" -> 2160;
            case "1440p", "2k" -> 1440;
            case "1080p" -> 1080;
            case "720p" -> 720;
            case "576p" -> 576;
            case "540p" -> 540;
            case "480p" -> 480;
            default -> 0;
        };
    }
}
