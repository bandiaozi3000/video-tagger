package com.videotagger.reconcile;

import com.videotagger.mapper.MediaReconcileMapper;
import com.videotagger.metadata.MetadataRecord;

import java.util.List;

/**
 * 对账的一条判定：**做什么 + 为什么**。本身不执行任何写操作。
 *
 * @param mediaId       本地 media id
 * @param title         本地标题
 * @param year          本地年份（可空）
 * @param action        处置动作（只有 AUTO / PURGE 两类）
 * @param externalId    命中的 Bangumi 条目 id（未命中为 null）
 * @param matchedTitle  命中的 Bangumi 标题（供复核）
 * @param via           靠什么命中的：name_cn / name / romaji / english / alias / similar:xxx
 * @param score         相似度（精确命中为 1.0）
 * @param linkedMediaId 命中的条目**已在本地关联**到哪条 media（非空 → 走合并而不是新建）
 * @param hasRefs       是否被引用（收藏夹/标签/集/映射/混剪工程）
 * @param hasEdits      是否有本地人工痕迹（备注/评分/别名/子分类/季&gt;1/非 VIDEO 格式/非 WANT 状态）
 * @param note          判定理由
 */
public record ReconcileDecision(
        long mediaId,
        String title,
        Integer year,
        ReconcileAction action,
        String externalId,
        String matchedTitle,
        String via,
        double score,
        Long linkedMediaId,
        boolean hasRefs,
        boolean hasEdits,
        String note
) {

    public static ReconcileDecision purge(MediaReconcileMapper.UnlinkedRow row, String reason) {
        return new ReconcileDecision(row.id(), row.title(), row.year(), ReconcileAction.PURGE,
                null, null, null, 0, null, row.hasRefs(), row.hasEdits(), reason);
    }

    public static ReconcileDecision auto(MediaReconcileMapper.UnlinkedRow row,
                                        MediaReconcileMatcher.Match match, Long linkedMediaId) {
        String note = linkedMediaId == null
                ? "新建关联"
                : "本地 media " + linkedMediaId + " 已关联同一条目 → 合并";
        return new ReconcileDecision(row.id(), row.title(), row.year(), ReconcileAction.AUTO,
                match.externalId(), match.matchedTitle(), match.via(), match.score(),
                linkedMediaId, row.hasRefs(), row.hasEdits(), note);
    }

    /** 有引用但关联不上：把「为什么没关联上」和 top 候选一并记下来，方便事后回看。 */
    public static ReconcileDecision purgeUnmatched(MediaReconcileMapper.UnlinkedRow row,
                                                  MediaReconcileMatcher.Match near,
                                                  List<MetadataRecord> candidates) {
        if (near != null) {
            return new ReconcileDecision(row.id(), row.title(), row.year(), ReconcileAction.PURGE,
                    near.externalId(), near.matchedTitle(), near.via(), near.score(), null,
                    row.hasRefs(), row.hasEdits(),
                    "相似但不精确（" + String.format("%.2f", near.score()) + "），按规则删除");
        }
        String top = candidates == null ? "" : candidates.stream().limit(3)
                .map(c -> c.externalId() + " " + c.displayTitle())
                .reduce((a, b) -> a + " | " + b).orElse("");
        return new ReconcileDecision(row.id(), row.title(), row.year(), ReconcileAction.PURGE,
                null, null, null, 0, null, row.hasRefs(), row.hasEdits(),
                top.isEmpty() ? "命不中 Bangumi，按规则删除" : "命不中；候选 top3: " + top);
    }

    /** 搜索失败（网络/限流）——同样删，但要能看出是「没搜成」而不是「搜了没有」。 */
    public static ReconcileDecision purgeSearchFailed(MediaReconcileMapper.UnlinkedRow row, String message) {
        return new ReconcileDecision(row.id(), row.title(), row.year(), ReconcileAction.PURGE,
                null, null, null, 0, null, row.hasRefs(), row.hasEdits(),
                "搜索失败，按规则删除: " + message);
    }
}
