package com.videotagger.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * 视频指纹：把带一堆 tracking 参数的 URL 归一化成稳定的"同一视频"标识。
 * 剔除广告/分享/播放列表类参数，保留分 P 参数（如 B站 p=），保证分 P 视频不被拆散、
 * 而同一视频在不同来源下能正确聚合。
 */
public final class VideoFingerprint {

    private VideoFingerprint() {
    }

    private static final Set<String> TRACKING = Set.of(
            "from", "spm", "spm_id_from", "vd_source", "share_source",
            "share_medium", "share_plat", "share_session_id", "share_tag",
            "share_unique_id", "share_times", "plat_id", "tdsourcetag",
            "s_kw", "s_kw_rdid", "s_from", "rid", "list", "si", "pp",
            "feature", "index", "start_radio", "ab_channel", "t",
            "utm_source", "utm_medium", "utm_campaign", "utm_term",
            "utm_content", "fbclid", "gclid", "msclkid");

    /** 归一化 URL：去 fragment、剔除 tracking 参数、参数按 key 排序保证稳定。 */
    public static String normalize(String url) {
        if (url == null) {
            return "";
        }
        String noFragment = url.contains("#") ? url.substring(0, url.indexOf('#')) : url;
        int qIdx = noFragment.indexOf('?');
        if (qIdx < 0) {
            return noFragment;
        }
        String base = noFragment.substring(0, qIdx);
        String query = noFragment.substring(qIdx + 1);
        Map<String, String> kept = new TreeMap<>();
        for (String pair : query.split("&")) {
            if (pair.isEmpty()) {
                continue;
            }
            int eq = pair.indexOf('=');
            String key = eq < 0 ? pair : pair.substring(0, eq);
            String val = eq < 0 ? "" : pair.substring(eq + 1);
            if (TRACKING.contains(key)) {
                continue;
            }
            kept.put(key, val);
        }
        if (kept.isEmpty()) {
            return base;
        }
        StringBuilder sb = new StringBuilder(base).append('?');
        boolean first = true;
        for (Map.Entry<String, String> e : kept.entrySet()) {
            if (!first) {
                sb.append('&');
            }
            sb.append(e.getKey()).append('=').append(e.getValue());
            first = false;
        }
        return sb.toString();
    }

    /** 归一化 URL 的 SHA-256 十六进制（64 位），作为 clips.video_fp 存库。 */
    public static String fingerprint(String url) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(normalize(url).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : hash) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
