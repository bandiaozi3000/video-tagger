package com.videotagger.videosource.torrent;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 种子标题解析器（纯函数，v0.25 D1）：从 RSS 标题抽 组/来源/分辨率/编码/集号/语种线索/合集标记。
 *  只做"能稳定识别的字段"，识别不出返回 null/空——宁缺毋滥，交给启发式与精判兜底。 */
public final class TorrentTitleParser {

    private static final Pattern GROUP = Pattern.compile(
            "^(?:\\[([^\\[\\]]{1,40})\\]|\\(([^()]{1,40})\\)|【([^【】]{1,40})】)");
    private static final Pattern RESOLUTION = Pattern.compile(
            "(?i)\\b(2160p|4K|1440p|2K|1080p|720p|576p|540p|480p)\\b");
    private static final Pattern PIXELS = Pattern.compile("\\b\\d{3,4}x(2160|1440|1080|720|576|540|480)\\b");
    private static final Pattern CODEC = Pattern.compile(
            "(?i)\\b(x264|h264|avc|x265|hevc|h265|av1)\\b");
    private static final Pattern SOURCE = Pattern.compile(
            "(?i)\\b(BDRip|BDMV|Remux|WEB-DL|WEBDL|WEBRip|WebRip|WEB|BluRay|Blu-ray|HDTV|DVD|R2J|RAW)\\b");
    /** 显式集号标记：EP01 / E01 / 第01集 / 第5話 …（后继须为 分隔符/结束/集话字） */
    private static final Pattern EP_MARKED = Pattern.compile(
            "(?i)(?:^|[\\s._\\-\\[\\]【】()])(?:EP|E|第)\\s*0*(\\d{1,3})(?:v\\d+)?(?=[\\s._\\-\\[\\]【】()集话話]|$)");
    /** 无标记独立数字候选（ANK-Raws 风格 " 01 ("、Web 风格 " - 12"）：逐个扫描，取"最后一个非片名编号" */
    private static final Pattern EP_PLAIN = Pattern.compile(
            "(?:^|[\\s._\\[\\]【】()\\-–—])0*(\\d{1,3})(?!\\p{L})(?!\\d)");
    /** 片名固有编号词（Movie 26 / Part 2 / das Finale 1 / Vol.3）——不得当集号 */
    private static final Set<String> NON_EPISODE_WORDS = Set.of(
            "movie", "movies", "part", "parts", "finale", "vol", "vols", "volume", "volumes",
            "ova", "ovas", "special", "specials", "sp", "chapter", "chapters", "劇場版", "映画", "巻");
    /** 合集区间：仅「括号包裹」或「数字间无空格连字符」两种形态（"S2 - 01" 的空格短横线不命中） */
    private static final Pattern RANGE = Pattern.compile(
            "(?:[\\[\\[(【（]\\s*\\d{1,3}\\s*[-~～]\\s*\\d{1,3}\\s*[\\]】）)]|\\d{1,3}[-~～]\\d{1,3})");
    private static final Pattern BATCH_WORD = Pattern.compile(
            "(?i)\\b(batch|全集|合集)\\b");
    /** 全12话/全12集（“全N话”合集表述） */
    private static final Pattern FULL_EP = Pattern.compile("(?i)全\\s*\\d{1,3}\\s*[集话話]");
    private static final Pattern LANG = Pattern.compile(
            "(?i)(简体中文|简中|简日|繁體|繁中|简繁|中英|双语|多语|多字幕|外挂字幕|内封字幕|内挂字幕|softsubs?|multi[- ]subs?|english|chinese)");
    private static final Pattern NOISE = Pattern.compile(
            "(?i)\\b(2160p|4K|1440p|2K|1080p|720p|576p|540p|480p|\\d{3,4}x\\d{3,4}|x264|h264|avc|x265|hevc|h265|av1|"
                    + "BDRip|BDMV|Remux|WEB-DL|WEBDL|WEBRip|WebRip|WEB|BluRay|Blu-ray|HDTV|DVD|R2J|RAW|"
                    + "batch|全集|合集|全\\d+[集话話]|第\\d+[集话話]|EP\\d+|E\\d+|\\b\\d{1,3}v\\d+|10bit|8bit|flac|aac|lossless|"
                    + "简日|简体中文|简中|繁體|繁中|简繁|中英|双语|多语|多字幕|外挂字幕|内封字幕|内挂字幕|softsubs?|multi[- ]subs?|"
                    + "\\d{1,3}\\s*[-~～]\\s*\\d{1,3})\\b");

    private TorrentTitleParser() {
    }

    public static TorrentTitleInfo parse(String title) {
        String raw = title == null ? "" : title.trim();
        if (raw.isEmpty()) {
            return new TorrentTitleInfo("", null, null, null, null, null, List.of(), false, "");
        }
        String group = firstNonBlank(match(GROUP, raw, 1), match(GROUP, raw, 2), match(GROUP, raw, 3));
        String resolution = firstNonBlank(match(RESOLUTION, raw, 0), pixelResolution(match(PIXELS, raw, 1)));
        String codec = lower(match(CODEC, raw, 0));
        String source = match(SOURCE, raw, 0);
        String lang = match(LANG, raw, 0);
        boolean batch = RANGE.matcher(raw).find() || BATCH_WORD.matcher(raw).find() || FULL_EP.matcher(raw).find();
        List<Integer> episodes = new ArrayList<>();
        if (!batch) {
            String marked = match(EP_MARKED, raw, 1);
            if (marked != null) {
                episodes.add(Integer.parseInt(marked));
            } else {
                Integer plain = lastPlainEpisode(raw);
                if (plain != null) {
                    episodes.add(plain);
                }
            }
        }
        String mediaTitle = stripNoise(raw);
        return new TorrentTitleInfo(raw, group, source, resolution, codec, lang, List.copyOf(episodes), batch, mediaTitle);
    }

    /** 无标记独立数字：取最后一个“非片名编号词打头”的数字段；1080p/4K/10bit/年份已被断言挡住。 */
    private static Integer lastPlainEpisode(String raw) {
        Matcher m = EP_PLAIN.matcher(raw);
        Integer last = null;
        while (m.find()) {
            String num = m.group(1);
            int value = Integer.parseInt(num);
            if (value < 1 || value > 999) {
                continue;
            }
            if (precededByNonEpisodeWord(raw, m.start())) {
                continue;
            }
            last = value;
        }
        return last;
    }

    /** 数字段前 24 字符内的最后一个“词”命中片名编号词表 → 判定为非集号（如 "Movie 26"）。 */
    private static boolean precededByNonEpisodeWord(String raw, int numberStart) {
        int from = Math.max(0, numberStart - 24);
        String before = raw.substring(from, numberStart);
        Matcher wm = Pattern.compile("(?i)([\\p{L}\\p{N}]+)\\s*$").matcher(before);
        if (!wm.find()) {
            return false;
        }
        String word = wm.group(1).toLowerCase(Locale.ROOT);
        return NON_EPISODE_WORDS.contains(word);
    }

    private static String stripNoise(String raw) {
        String out = NOISE.matcher(raw).replaceAll(" ").replaceAll("[\\[\\]【】()]", " ").trim();
        return out.replaceAll("\\s{2,}", " ").trim();
    }

    private static String match(Pattern p, String text, int group) {
        Matcher m = p.matcher(text);
        if (!m.find()) {
            return null;
        }
        return m.group(group);
    }

    private static String pixelResolution(String height) {
        if (height == null) {
            return null;
        }
        return switch (height) {
            case "2160" -> "4K";
            case "1440" -> "1440p";
            default -> height + "p";
        };
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }

    private static String lower(String v) {
        return v == null ? null : v.toLowerCase(Locale.ROOT);
    }
}
