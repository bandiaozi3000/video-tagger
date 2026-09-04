package com.videotagger.videosource.torrent;

import java.util.List;
import java.util.Locale;

/** 精判复核（v0.25 D2）：用引擎拉到的种子文件清单细化档位——发现外挂字幕文件 → SOFT（FILE_LIST 依据）；
 *  纯视频文件则维持原启发式档（内封轨需下载后 ffprobe 才能确认，属已知局限）。 */
public final class TorrentSubtitleVerifier {

    private static boolean isExternalSubtitle(String fileName) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        return lower.endsWith(".ass") || lower.endsWith(".ssa")
                || lower.endsWith(".srt") || lower.endsWith(".vtt") || lower.endsWith(".sub");
    }

    /** 返回复核后的候选副本；无可判依据时原样返回。 */
    public static RankedCandidate refine(RankedCandidate candidate, List<String> fileNames) {
        if (candidate == null || fileNames == null) {
            return candidate;
        }
        boolean hasExternal = fileNames.stream().anyMatch(TorrentSubtitleVerifier::isExternalSubtitle);
        if (hasExternal && candidate.tier() != SubtitleTier.RAW) {
            // 外挂字幕文件存在 → 确认为字幕分离（即使启发式判 UNKNOWN/HARD）
            return new RankedCandidate(candidate.providerId(), candidate.itemId(), candidate.title(),
                    SubtitleTier.SOFT, "FILE_LIST", candidate.group(), candidate.resolutionHeight(),
                    candidate.codec(), candidate.bytes(), candidate.batch(), candidate.episodes());
        }
        return candidate;
    }

    private TorrentSubtitleVerifier() {
    }
}
