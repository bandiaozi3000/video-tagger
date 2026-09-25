package com.videotagger.reconcile;

import com.videotagger.metadata.MetadataRecord;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 把本地 media 标题对到 Bangumi 候选上（纯函数，不联网、不写库）。
 *
 * <p><b>为什么不用 {@code matchType=EXTERNAL_ID}</b>：实测 40 条样本，那个信号会误判 23%
 * —— 「轻松熊」被判成「摇曳百合」「无自觉圣女」被判成「无敌看板娘」，只因为 Bangumi 的
 * 关键词搜索太宽（12 个抽样里 8 个返回 ≥20 条），20 条里混进一个不相干的**已关联**条目就触发。
 * 这里改成「**名字或别名归一化后精确相等**」，严得多也准得多。
 *
 * <p><b>关键点</b>：候选的比对集合必须包含 {@code infobox.别名}。实测「描绘直至生命尽头」
 * 与 Bangumi 的 {@code name_cn}「画完这个再去死」相似度为 0.00，但**它就写在别名里**。
 *
 * <p><b>多候选精确命中</b>用「年份 + 集数」双重校验消歧（用户 2026-09-25 拍板 1B），
 * 校验不过就返回 null 交人工，绝不硬猜。
 */
public final class MediaReconcileMatcher {

    /** 相似度兜底阈值：达到才进「人工确认」层（②），永不自动执行。 */
    public static final double NEAR_THRESHOLD = 0.8;

    private MediaReconcileMatcher() {
    }

    /** 命中结果。{@code via} 说明是靠哪个字段命中的，供报告与复核。 */
    public record Match(String externalId, String matchedTitle, String via, double score, boolean exact) {
    }

    private record Candidate(String externalId, String title, Integer year, Integer episodeCount,
                             Map<String, String> normalizedToVia) {
    }

    /**
     * @param localYear 本地年份（可空）；精确命中多候选时用来消歧，相似度兜底时用来做硬门槛
     * @param localEps  本地集数（可空）；同上
     * @return 唯一高置信命中；无命中或分不开都返回 {@code null}
     */
    public static Match best(List<MetadataRecord> candidates, String localTitle,
                             Integer localYear, Integer localEps) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        String target = TitleNormalizer.normalize(localTitle);
        if (target.isEmpty()) {
            return null;
        }
        List<Candidate> list = candidates.stream().map(MediaReconcileMatcher::toCandidate).toList();

        // ① 精确命中（名字或别名）
        List<Match> exact = new ArrayList<>();
        for (Candidate c : list) {
            String via = c.normalizedToVia().get(target);
            if (via != null) {
                exact.add(new Match(c.externalId(), c.title(), via, 1.0, true));
            }
        }
        if (exact.size() == 1) {
            return exact.get(0);
        }
        if (exact.size() > 1) {
            return disambiguate(exact, list, localYear, localEps);
        }

        // ② 相似度兜底：只在没有任何精确命中时才做；年份对不上直接出局
        Match bestNear = null;
        for (Candidate c : list) {
            if (localYear != null && c.year() != null && !localYear.equals(c.year())) {
                continue;
            }
            for (Map.Entry<String, String> e : c.normalizedToVia().entrySet()) {
                double s = TitleNormalizer.similarityNormalized(target, e.getKey());
                if (s >= NEAR_THRESHOLD && (bestNear == null || s > bestNear.score())) {
                    bestNear = new Match(c.externalId(), c.title(), "similar:" + e.getValue(), s, false);
                }
            }
        }
        return bestNear;
    }

    /**
     * 多个候选精确同名 → 先按年份过，再按集数过。
     * 两者都分不开就返回 null（交人工），不做概率猜测。
     */
    private static Match disambiguate(List<Match> exact, List<Candidate> list, Integer localYear, Integer localEps) {
        Map<String, Candidate> byId = new LinkedHashMap<>();
        for (Candidate c : list) {
            byId.put(c.externalId(), c);
        }
        List<Match> pool = exact;
        if (localYear != null) {
            List<Match> narrowed = pool.stream()
                    .filter(m -> localYear.equals(byId.get(m.externalId()).year()))
                    .toList();
            if (narrowed.size() >= 1) {
                pool = narrowed;
            }
        }
        if (pool.size() == 1) {
            return pool.get(0);
        }
        if (localEps != null) {
            List<Match> narrowed = pool.stream()
                    .filter(m -> localEps.equals(byId.get(m.externalId()).episodeCount()))
                    .toList();
            if (narrowed.size() == 1) {
                return narrowed.get(0);
            }
        }
        return null;
    }

    private static Candidate toCandidate(MetadataRecord r) {
        Map<String, String> normalized = new LinkedHashMap<>();
        put(normalized, r.canonicalTitle(), "name_cn");
        put(normalized, r.nativeTitle(), "name");
        put(normalized, r.romajiTitle(), "romaji");
        put(normalized, r.englishTitle(), "english");
        if (r.aliases() != null) {
            for (String alias : r.aliases()) {
                put(normalized, alias, "alias");
            }
        }
        return new Candidate(r.externalId(), r.displayTitle(), r.year(), r.episodeCount(), normalized);
    }

    /** 归一化后放进去；同名不同来源只留第一个（name_cn 优先），但 via 要能看出是别名命中。 */
    private static void put(Map<String, String> map, String raw, String via) {
        String key = TitleNormalizer.normalize(raw);
        if (!key.isEmpty()) {
            map.putIfAbsent(key, via);
        }
    }
}
