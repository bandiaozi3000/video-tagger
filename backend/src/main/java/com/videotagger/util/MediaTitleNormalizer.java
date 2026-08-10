package com.videotagger.util;

/**
 * 媒体标题归一化 + 相似度：打标签候选匹配用——识别「爱你宝贝」≈「我爱你BABY」这类
 * 中英混写 / 词序差异（纯 LIKE 包含匹配不上）。
 *
 * 归一化：去括号内容/标点/空格、小写、中英等价（baby↔宝贝）、去常见后缀、去单字虚词。
 * 相似度：归一化相等=1 / 一方包含另一方=0.9 / 编辑距离≤3 递减 / 否则 0。
 */
public final class MediaTitleNormalizer {

    private MediaTitleNormalizer() {
    }

    /** 归一化：返回核心词串（保留名词/动词，去虚词与噪音）。 */
    public static String normalize(String t) {
        if (t == null) return "";
        String s = t.toLowerCase();
        s = s.replaceAll("[（(][^（()）]*[)）]", "");                       // 去括号内容
        s = s.replaceAll("[\\s·,，。.!！?？:：;；'\"“”‘’\\-—_/\\\\|]", ""); // 去标点空格
        s = s.replaceAll("(?i)baby", "宝贝");                              // 中英等价（可扩展）
        s = s.replace("剧场版", "").replace("ova", "");                    // 常见后缀
        s = s.replaceAll("[我的之你和与及于在对于们]", "");                 // 去单字虚词，保留核心名词/动词
        return s;
    }

    /** 相似度 0~1：归一化相等=1 / 包含=0.9 / 编辑距离≤3 递减 / 否则 0。 */
    public static double similarity(String a, String b) {
        String na = normalize(a), nb = normalize(b);
        if (na.isEmpty() || nb.isEmpty()) return 0;
        if (na.equals(nb)) return 1.0;
        if (na.contains(nb) || nb.contains(na)) return 0.9;
        int dist = levenshtein(na, nb);
        if (dist <= 3) return Math.max(0, 0.85 - dist * 0.15);
        return 0;
    }

    /** Levenshtein 编辑距离（滚动数组）。 */
    static int levenshtein(String a, String b) {
        if (a.length() < b.length()) { String t = a; a = b; b = t; }
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1),
                        prev[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
            }
            int[] tmp = prev; prev = cur; cur = tmp;
        }
        return prev[b.length()];
    }
}
