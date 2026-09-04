package com.videotagger.videosource.torrent;

import java.util.Locale;
import java.util.Set;

/** 字幕三态启发式（v0.25 D2 粗筛）：组语义白名单 + 标题显式字幕词。
 *  产物仅为"疑似档"——胜负难分时由 swarm 文件清单精判复核。 */
public final class SubtitleTierHeuristic {

    /** 已知 RAW 组（无字幕轨）：国际 Web/BD raw 压制为主。 */
    private static final Set<String> RAW_GROUPS = Set.of(
            "subsplease", "erai-raws", "judas", "reinfeforce", "reinforce", "gjm", "horriblesubs",
            "toonshub", "anime time", "ank-raws", "moozzi2", "beatrice-raws", "varyg",
            "tsundere-raws", "fumoffu", "atheris", "filmic", "iez");

    /** 已知"字幕分离"组：作品惯例内封软字幕或另附外挂字幕（VCB-Studio / LoliHouse / 常见中文组）。 */
    private static final Set<String> SOFT_GROUPS = Set.of(
            "vcb-studio", "lolihouse", "sweetsub", "dhr", "爱恋字幕社", "爱恋", "千夏字幕组", "千夏",
            "桜都字幕组", "桜都", "樱花字幕组", "动漫国字幕组", "动漫国", "诸神字幕组", "诸神", "幻之字幕组", "幻之",
            "雪飘工作室", "雪飘", "极影字幕社", "极影", "澄空学园", "澄空", "华盟字幕社", "华盟", "喵萌奶茶屋",
            "喵萌", "悠哈璃羽", "漫猫字幕组", "风车字幕组", "百合作文", "豌豆字幕组", "霜枫字幕组", "北宇治字幕组",
            "灵风字幕组", "星空字幕组");

    /** 硬烧显式词（命中即 HARD，强于组白名单）。 */
    private static final Set<String> HARD_TOKENS = Set.of(
            "hardsub", "hardsubs", "硬字幕", "内嵌硬字幕", "烧录字幕", "内置硬字幕");

    /** 软字幕显式词（命中即 SOFT，强于 RAW 组白名单——组也可能发多字幕版）。 */
    private static final Set<String> SOFT_TOKENS = Set.of(
            "softsub", "softsubs", "外挂字幕", "外挂", "内封字幕", "内封", "内挂字幕", "内挂",
            "multi-sub", "multi-subs", "multiple subtitle", "multiple subtitles", "多字幕", "简日", "简繁", "中英", "双语", "附字幕", "ass字幕", "srt字幕");

    private SubtitleTierHeuristic() {
    }

    /** 粗筛分档；basis 说明依据来源（EXPLICIT_TOKEN / GROUP_WHITELIST / UNKNOWN）。 */
    public static TierGuess guess(TorrentTitleInfo info) {
        String hay = (info.rawTitle() + " " + nullSafe(info.group())).toLowerCase(Locale.ROOT);
        for (String token : HARD_TOKENS) {
            if (hay.contains(token)) {
                return new TierGuess(SubtitleTier.HARD, "EXPLICIT_TOKEN", token);
            }
        }
        for (String token : SOFT_TOKENS) {
            if (hay.contains(token)) {
                return new TierGuess(SubtitleTier.SOFT, "EXPLICIT_TOKEN", token);
            }
        }
        String group = info.group() == null ? "" : info.group().toLowerCase(Locale.ROOT);
        if (containsAny(RAW_GROUPS, group)) {
            return new TierGuess(SubtitleTier.RAW, "GROUP_WHITELIST", info.group());
        }
        if (containsAny(SOFT_GROUPS, group)) {
            return new TierGuess(SubtitleTier.SOFT, "GROUP_WHITELIST", info.group());
        }
        return new TierGuess(SubtitleTier.UNKNOWN, "UNKNOWN", null);
    }

    private static boolean containsAny(Set<String> whitelist, String group) {
        return whitelist.stream().anyMatch(group::contains);
    }

    private static String nullSafe(String v) {
        return v == null ? "" : v;
    }

    public record TierGuess(SubtitleTier tier, String basis, String token) {
    }
}
