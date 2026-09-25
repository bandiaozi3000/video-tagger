package com.videotagger.reconcile;

import com.videotagger.mapper.MediaReconcileMapper;
import com.videotagger.metadata.MetadataProvider;
import com.videotagger.metadata.MetadataRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 媒体库对账：**只读**盘点器（用户 2026-09-25 拍板的规则）。
 *
 * <pre>
 * 未关联 media
 * ├─ 无引用、无人工痕迹              → PURGE（不打 Bangumi，直接删）
 * ├─ 有引用/痕迹 + 能精确关联到 Bangumi → AUTO（LINK 新建关联 / MERGE 合并进已关联那条）
 * └─ 有引用/痕迹 + 关联不上            → PURGE（按「剩余的全部删掉」规则）
 * </pre>
 *
 * <p><b>只扫未关联的</b>：已关联的一律不动。跑第二遍天然幂等（该删的已经没了）。
 *
 * <p>⚠️ 本类只读，不写任何表。
 */
@Service
public class MediaReconcilePlanner {

    private static final Logger log = LoggerFactory.getLogger(MediaReconcilePlanner.class);

    /** Bangumi 关键词搜索的召回条数：实测 12 个抽样里 8 个返回 ≥20 条，20 够用。 */
    private static final int SEARCH_LIMIT = 20;

    private final MediaReconcileMapper mapper;
    private final MetadataProvider provider;

    public MediaReconcilePlanner(MediaReconcileMapper mapper, MetadataProvider provider) {
        this.mapper = mapper;
        this.provider = provider;
    }

    /**
     * 盘点结果。
     *
     * @param purgeNoRefs   无引用无痕迹 → 删
     * @param purgeNear     有引用、相似但不精确 → 删
     * @param purgeNone     有引用、命不中 → 删
     * @param lastId        本批最大 id（下一轮的 id 游标）
     */
    public record PlanResult(int scanned, int auto, int link, int merge,
                             int purgeNoRefs, int purgeNear, int purgeNone, long lastId,
                             List<ReconcileDecision> decisions) {
        public static PlanResult empty() {
            return new PlanResult(0, 0, 0, 0, 0, 0, 0, 0, List.of());
        }
    }

    /**
     * 盘点一批未关联 media。
     *
     * @param limit   本批条数
     * @param afterId **id 游标**：只取 id 大于它的（不是 OFFSET，理由见 mapper 注释）
     */
    public PlanResult plan(int limit, long afterId) {
        List<MediaReconcileMapper.UnlinkedRow> rows = mapper.listUnlinked(limit, afterId);
        if (rows.isEmpty()) {
            return PlanResult.empty();
        }
        List<ReconcileDecision> decisions = new ArrayList<>(rows.size());
        int auto = 0;
        int link = 0;
        int merge = 0;
        int purgeNoRefs = 0;
        int purgeNear = 0;
        int purgeNone = 0;
        long lastId = afterId;

        for (MediaReconcileMapper.UnlinkedRow row : rows) {
            lastId = Math.max(lastId, row.id());

            // ① 无引用、无人工痕迹：不打 Bangumi，直接删（省下上千次请求）
            if (!row.hasRefs() && !row.hasEdits()) {
                purgeNoRefs++;
                decisions.add(ReconcileDecision.purge(row, "无引用、无人工痕迹"));
                continue;
            }

            // ② 有引用/痕迹：试着关联
            List<MetadataRecord> candidates;
            try {
                candidates = provider.search(row.title(), SEARCH_LIMIT);
            } catch (Exception e) {
                purgeNone++;
                decisions.add(ReconcileDecision.purgeSearchFailed(row, e.getMessage()));
                log.warn("对账搜索失败 media={} title={}: {}", row.id(), row.title(), e.getMessage());
                continue;
            }
            MediaReconcileMatcher.Match match =
                    MediaReconcileMatcher.best(candidates, row.title(), row.year(), row.episodeCount());

            if (match != null && match.exact()) {
                Long linkedMediaId = mapper.findLinkedMediaId(match.externalId());
                if (linkedMediaId == null) {
                    link++;
                } else {
                    merge++;
                }
                auto++;
                decisions.add(ReconcileDecision.auto(row, match, linkedMediaId));
            } else if (match != null) {
                // 相似但不精确 → 按「剩余的其他全部删掉」删
                purgeNear++;
                decisions.add(ReconcileDecision.purgeUnmatched(row, match, candidates));
            } else {
                purgeNone++;
                decisions.add(ReconcileDecision.purgeUnmatched(row, null, candidates));
            }
        }
        return new PlanResult(rows.size(), auto, link, merge, purgeNoRefs, purgeNear, purgeNone, lastId, decisions);
    }
}
