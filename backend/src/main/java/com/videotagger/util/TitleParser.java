package com.videotagger.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 从页面标题解析「番剧名 + 季号 + 集号」。
 * 标题格式千变万化（B站分篇、字幕组站、YouTube、网盘），只覆盖常见模式；
 * 解析的正确性并非本工具目标——番剧归属的最终兜底是手工确认（A 做轻 / B 做全）。
 * 打标主链路仅此本地纯正则，绝不调用 LLM。
 */
public final class TitleParser {

    private TitleParser() {
    }

    /** 解析结果。mediaTitle 保证非空（解析失败时回退为去站点后缀的原始标题）；
     *  subcategory 为标题关键词探测的子分类（如「第X集」→番剧），可空，探测属 Phase B。 */
    public record ParsedTitle(String mediaTitle, Integer season, Integer episodeNo, String subcategory) {
    }

    private static final String[] SITE_SUFFIXES = {
            "_哔哩哔哩_bilibili", "_哔哩哔哩", "_bilibili", "哔哩哔哩_bilibili",
            "| YouTube", "| bilibili", "- 哔哩哔哩"
    };

    /** 季：第X季 / Season X / SXExx */
    private static final Pattern SEASON_CN = Pattern.compile("第\\s*([0-9一二三四五六七八九十百]+)\\s*季");
    private static final Pattern SEASON_EN = Pattern.compile("(?i)season\\s*([0-9]+)");
    private static final Pattern SEASON_SN = Pattern.compile("(?i)s([0-9]+)\\s*e[0-9]+");

    /** 集：第X集/话/章 / Episode X / Ep.X / SXEXX / EXX（E 后须紧跟数字，避免误伤英文单词） */
    private static final Pattern EP_CN = Pattern.compile("第\\s*([0-9一二三四五六七八九十百]+)\\s*[集话章]");
    private static final Pattern EP_EN = Pattern.compile("(?i)(?:episode|ep)\\s*\\.?\\s*([0-9]+)");
    private static final Pattern EP_SN = Pattern.compile("(?i)s[0-9]+\\s*e([0-9]+)");
    private static final Pattern EP_BARE_E = Pattern.compile("(?i)\\be([0-9]{1,3})\\b");

    public static ParsedTitle parse(String rawTitle) {
        if (rawTitle == null) {
            return new ParsedTitle("", null, null, null);
        }
        String t = stripSiteSuffix(rawTitle.trim());

        Integer season = firstInt(t, SEASON_CN, SEASON_EN, SEASON_SN);
        Integer episode = firstInt(t, EP_CN, EP_EN, EP_SN, EP_BARE_E);

        String media = cleanName(stripMarks(t));
        if (media.isEmpty()) {
            media = cleanName(t);
        }
        if (media.isEmpty()) {
            media = t;
        }
        return new ParsedTitle(media, season, episode, detectSubcategory(t));
    }

    /** 标题关键词 → 子分类探测：命中「第X集/第X话/SXE」等剧集标记视为连续剧类（番剧），可空。 */
    private static String detectSubcategory(String t) {
        if (SEASON_CN.matcher(t).find() || SEASON_EN.matcher(t).find() || SEASON_SN.matcher(t).find()
                || EP_CN.matcher(t).find() || EP_EN.matcher(t).find() || EP_SN.matcher(t).find()
                || EP_BARE_E.matcher(t).find()) {
            return "番剧";
        }
        return null;
    }

    private static String stripSiteSuffix(String t) {
        for (String suffix : SITE_SUFFIXES) {
            if (t.endsWith(suffix)) {
                return t.substring(0, t.length() - suffix.length()).trim();
            }
        }
        return t;
    }

    /** 从多个模式里取第一个命中的数字（中文数字转阿拉伯）。 */
    private static Integer firstInt(String text, Pattern... patterns) {
        for (Pattern p : patterns) {
            Matcher m = p.matcher(text);
            if (m.find()) {
                return cnToInt(m.group(1));
            }
        }
        return null;
    }

    /** 删除季/集标记片段，剩下番剧名前缀。 */
    private static String stripMarks(String t) {
        String s = t;
        s = s.replaceAll("第\\s*[0-9一二三四五六七八九十百]+\\s*季", " ");
        s = s.replaceAll("第\\s*[0-9一二三四五六七八九十百]+\\s*[集话章]", " ");
        s = s.replaceAll("(?i)season\\s*[0-9]+", " ");
        s = s.replaceAll("(?i)(?:episode|ep)\\s*\\.?\\s*[0-9]+", " ");
        s = s.replaceAll("(?i)s[0-9]+\\s*e[0-9]+", " ");
        s = s.replaceAll("(?i)\\be[0-9]{1,3}\\b", " ");
        return s;
    }

    /** 清理番剧名：去掉【xx】前缀、首尾分隔符与标点，压缩空白。 */
    private static String cleanName(String s) {
        if (s == null) {
            return "";
        }
        s = s.replaceAll("^[【\\[（(][^】\\]）)]*[】\\]）)]\\s*", "");
        s = s.replaceAll("^[\\s\\-–—:|]+", "");
        s = s.replaceAll("[\\s，。！？,.!?·；;：:]+$", "");
        s = s.replaceAll("\\s+", " ").trim();
        return s;
    }

    /** 阿拉伯/中文数字统一转 int（支持 1~99，百位仅用于季如「第一百」）。 */
    static int cnToInt(String s) {
        if (s == null || s.isEmpty()) {
            return 0;
        }
        if (s.matches("\\d+")) {
            return Integer.parseInt(s);
        }
        int idxHundred = s.indexOf("百");
        if (idxHundred >= 0) {
            int hundreds = idxHundred == 0 ? 1 : cnDigit(s.charAt(idxHundred - 1));
            return hundreds * 100 + cnToInt(s.substring(idxHundred + 1));
        }
        int idxTen = s.indexOf("十");
        if (idxTen >= 0) {
            int tens = idxTen == 0 ? 1 : cnDigit(s.charAt(idxTen - 1));
            String rest = s.substring(idxTen + 1);
            int ones = rest.isEmpty() ? 0 : cnDigit(rest.charAt(0));
            return tens * 10 + ones;
        }
        return cnDigit(s.charAt(0));
    }

    private static int cnDigit(char c) {
        int i = "零一二三四五六七八九".indexOf(c);
        return i < 0 ? 0 : i;
    }
}
