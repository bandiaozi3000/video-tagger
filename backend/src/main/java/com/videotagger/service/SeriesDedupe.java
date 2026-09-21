package com.videotagger.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 同系列归组（导出清单「去重」用）——纯函数，好测。
 *
 * 用户 2026-09-21 要求：「番剧 A、A OVA → 去重时只保留本体，不显示 OVA、第二季等关联媒体」。
 *
 * **依据是 Bangumi 关联表**（`external_relation`，与跨媒体借片段同一份数据、同一份白名单
 * {@link RelatedMediaService#VIDEO_RELATION_TYPES}），**不是** title 相似度：
 * 实测 `6917 草莓棉花糖(2005)` --番外篇--> `6648 OVA 第2期(2007)` / `6672 OVA 第1期(2007)`，
 * `7066 现视研(2004)` --续集/前传--> `6799 现视研2(2007)` / `6600 现视研 OVA(2006)`，都能直连本体。
 *
 * 已知边界（未做，避免误合并）：
 * ① 没拉到关联数据的媒体**不会被合并**（按标题兜底会误合并，例如「钢炼」与「钢炼 FA」）；
 * ② 关系按**无向**处理（实测 `前传/续集` 成对出现，但 `番外篇` 只有单边 → 不无向就会漏）。
 */
public final class SeriesDedupe {

    private SeriesDedupe() {
    }

    /**
     * 每个媒体 → 它所属系列的**本体** id（本体自己映射到自己）。
     *
     * 本体判据：**年份最早**（缺年份排最后）→ 再取**标题最短** → 再取 id 最小（完全确定，不受输入顺序影响）。
     */
    public static Map<Long, Long> baseOf(List<MediaExportRow> rows, List<LinkedPair> pairs) {
        Map<Long, Long> parent = new HashMap<>();
        for (MediaExportRow row : rows) {
            parent.put(row.id(), row.id());
        }
        for (LinkedPair pair : pairs) {
            if (pair == null || !parent.containsKey(pair.fromMediaId()) || !parent.containsKey(pair.toMediaId())) {
                continue;   // 关系另一端不在本次清单里 → 不参与归组
            }
            union(parent, pair.fromMediaId(), pair.toMediaId());
        }
        // 分组 → 选本体
        Map<Long, List<MediaExportRow>> groups = new HashMap<>();
        for (MediaExportRow row : rows) {
            groups.computeIfAbsent(find(parent, row.id()), key -> new ArrayList<>()).add(row);
        }
        Map<Long, Long> result = new HashMap<>();
        Set<Long> seenGroups = new LinkedHashSet<>();
        for (MediaExportRow row : rows) {
            long root = find(parent, row.id());
            result.putIfAbsent(row.id(), row.id());
            if (!seenGroups.add(root)) {
                continue;
            }
            MediaExportRow base = groups.get(root).stream().min(
                    Comparator.comparingInt((MediaExportRow r) -> r.year() == null ? Integer.MAX_VALUE : r.year())
                            .thenComparingInt(r -> r.title() == null ? Integer.MAX_VALUE : r.title().length())
                            .thenComparingLong(MediaExportRow::id)).orElse(row);
            for (MediaExportRow member : groups.get(root)) {
                result.put(member.id(), base.id());
            }
        }
        return result;
    }

    private static long find(Map<Long, Long> parent, long id) {
        long current = id;
        while (parent.get(current) != null && parent.get(current) != current) {
            long next = parent.get(current);
            parent.put(current, parent.get(next) == null ? next : parent.get(next));   // 路径压缩（一层）
            current = next;
        }
        return current;
    }

    private static void union(Map<Long, Long> parent, long a, long b) {
        long rootA = find(parent, a);
        long rootB = find(parent, b);
        if (rootA != rootB) {
            long small = Math.min(rootA, rootB);
            long large = Math.max(rootA, rootB);
            parent.put(large, small);   // 固定按 id 小的当根：并查集结果与输入顺序无关
        }
    }
}
