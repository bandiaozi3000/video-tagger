package com.videotagger.reconcile;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 标题归一化与相似度（媒体库对账用）。
 *
 * <p>为什么需要它：本地 5313 条未关联 media 的标题来自 AniList / omofuna 导入（第三套中文译名），
 * 与 Bangumi 的 {@code name_cn} 经常对不上。实测 40 条真实样本（设计规格 §4.4）：
 * <ul>
 *   <li>只比对 {@code name_cn} → 精确命中 <b>8%</b></li>
 *   <li>把 {@code infobox.别名} 一起纳入 → 精确命中 <b>72.5%</b>，宽松到相似度 ≥0.8 则 <b>82.5%</b></li>
 * </ul>
 *
 * <p>本类负责抹掉**纯书写差异**（空格 / 全半角 / 标点 / 中文数字 / 噪声后缀），
 * 让「暗芝居第十七季」与「暗芝居 第十七季」判为同一部。
 * <b>保留</b> `第 / 季 / 期 / 话 / 集` —— 那些是区分不同季的关键，不能抹。
 */
public final class TitleNormalizer {

    private TitleNormalizer() {
    }

    private static final Map<Character, Integer> CN_DIGIT = Map.of(
            '一', 1, '二', 2, '三', 3, '四', 4, '五', 5,
            '六', 6, '七', 7, '八', 8, '九', 9);

    /**
     * 噪声：去掉后「剧场版 X 红莲之绊篇」与「剧场版 X 红莲之绊」、
     * 「铠真传 武士骑兵 2」与「铠真传 武士骑兵 第2部分」判为同名。
     *
     * 「第」只是序数标记，抹掉**不影响区分季**：「第二季」→「2季」仍与「第三季」→「3季」不同。
     * 「part」与「部分」等价（实测「赛马娘 芦毛灰姑娘 Part 2」↔「赛马娘 芦毛灰姑娘 第2部分」）。
     */
    private static final String[] NOISE = {"部分", "篇", "章", "第", "part"};

    /** 要丢弃的字符（半角 + CJK 标点；全角 ASCII 会在归一化时先转半角）。 */
    private static final Set<Character> DROP = buildDropSet();

    private static Set<Character> buildDropSet() {
        Set<Character> set = new HashSet<>();
        for (char c : " \t".toCharArray()) set.add(c);
        for (char c : "~-:;·、,，.!?()[]{}<>/\\\"'’’“”*・".toCharArray()) set.add(c);
        // 波浪号有多个码位：全角 ～(U+FF5E) 转半角后已是 '~'，但 〜(U+301C) / 〰(U+3030) 不在此范围，
        // 实测本地数据用 〜、Bangumi 用 ～，不归一化就白白判不相等。
        for (char c : "　：；，。！？（）【】《》〈〉「」『』／＼…—–〜〰﹏".toCharArray()) set.add(c);
        return set;
    }

    /** 归一化：全角转半角 → 丢掉空白与标点 → 去噪声后缀 → 中文数字转阿拉伯。 */
    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String lower = raw.toLowerCase(Locale.ROOT);
        StringBuilder sb = new StringBuilder(lower.length());
        for (int i = 0; i < lower.length(); i++) {
            char c = lower.charAt(i);
            if (c >= 0xFF01 && c <= 0xFF5E) {
                c = (char) (c - 0xFEE0);   // 全角 ASCII → 半角
            }
            if (DROP.contains(c)) {
                continue;
            }
            sb.append(c);
        }
        String out = sb.toString();
        for (String noise : NOISE) {
            out = out.replace(noise, "");
        }
        return chineseDigitsToArabic(out);
    }

    /** 归一化后是否完全相等（两边的基线必须先非空，避免「都是空标题」被判相等）。 */
    public static boolean same(String a, String b) {
        String x = normalize(a);
        String y = normalize(b);
        return !x.isEmpty() && x.equals(y);
    }

    /** Levenshtein 比率：1 = 完全一致，0 = 毫无重叠。空串一律 0。 */
    public static double similarity(String a, String b) {
        String x = normalize(a);
        String y = normalize(b);
        if (x.isEmpty() || y.isEmpty()) {
            return 0;
        }
        if (x.equals(y)) {
            return 1;
        }
        return similarityNormalized(x, y);
    }

    /** 双方**已经归一化过**时用这个，省一次 normalize。 */
    public static double similarityNormalized(String x, String y) {
        if (x.isEmpty() || y.isEmpty()) {
            return 0;
        }
        if (x.equals(y)) {
            return 1;
        }
        int max = Math.max(x.length(), y.length());
        return 1.0 - (double) levenshtein(x, y) / max;
    }

    private static int levenshtein(String a, String b) {
        int n = b.length();
        int[] prev = new int[n + 1];
        int[] curr = new int[n + 1];
        for (int j = 0; j <= n; j++) {
            prev[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            curr[0] = i;
            for (int j = 1; j <= n; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(Math.min(prev[j] + 1, curr[j - 1] + 1), prev[j - 1] + cost);
            }
            int[] swap = prev;
            prev = curr;
            curr = swap;
        }
        return prev[n];
    }

    /** 中文数字串 → 阿拉伯（只处理 0–99，超长或含未知字符则原样返回）。 */
    private static String chineseDigitsToArabic(String s) {
        StringBuilder out = new StringBuilder(s.length());
        int i = 0;
        while (i < s.length()) {
            char c = s.charAt(i);
            if (CN_DIGIT.containsKey(c) || c == '十') {
                int j = i;
                while (j < s.length() && (CN_DIGIT.containsKey(s.charAt(j)) || s.charAt(j) == '十')) {
                    j++;
                }
                out.append(convertRun(s.substring(i, j)));
                i = j;
            } else {
                out.append(c);
                i++;
            }
        }
        return out.toString();
    }

    private static String convertRun(String run) {
        if (run.isEmpty() || run.length() > 4) {
            return run;   // 「一二三四五」不是数字，别乱转
        }
        int ten = run.indexOf('十');
        if (ten < 0) {
            StringBuilder sb = new StringBuilder();
            for (char c : run.toCharArray()) {
                Integer d = CN_DIGIT.get(c);
                if (d == null) {
                    return run;
                }
                sb.append(d);
            }
            return sb.toString();
        }
        if (run.length() > 3) {
            return run;
        }
        int tens = ten == 0 ? 1 : CN_DIGIT.getOrDefault(run.charAt(0), -1);
        int ones = ten == run.length() - 1 ? 0 : CN_DIGIT.getOrDefault(run.charAt(run.length() - 1), -1);
        if (tens < 0 || ones < 0) {
            return run;
        }
        return String.valueOf(tens * 10 + ones);
    }

    /** 便于报告：把一个标题的归一化结果连同原串列出。 */
    public static List<String> explain(String raw) {
        return new ArrayList<>(List.of(String.valueOf(raw), normalize(raw)));
    }
}
