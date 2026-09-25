package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 媒体库对账用的只读查询。
 *
 * <p>单独一个 mapper 而不是塞进 {@code MediaMapper}：这些 SQL 只服务于对账，
 * 且写法明显偏「统计型」，混进去会让那个已经 400 行的 mapper 更难读。
 */
@Mapper
public interface MediaReconcileMapper {

    /**
     * 未关联 Bangumi 的 media，连同两个判定标志一起取出来。
     *
     * <p>{@code hasRefs} / {@code hasEdits} 的口径写死在 SQL 里，与设计规格 §3.1 一致：
     * <ul>
     *   <li><b>hasRefs</b>：收藏夹、标签、集、文件名映射、混剪工程 —— 任一存在即为真</li>
     *   <li><b>hasEdits</b>：备注、评分、别名、子分类、季&gt;1、非 VIDEO 格式、状态非 WANT</li>
     * </ul>
     *
     * <p>⚠️ 故意**不包含** {@code cover_path} 与 {@code year}：2026-08-08 那次批量导入
     * 把这两列全填了（5313 条全有封面、全有年份），拿它们当人工痕迹会一条都删不掉。
     * <p>⚠️ **必须用 id 游标（{@code afterId}）分页，不能用 OFFSET**：live 模式下 media 会被
     * 关联走或被删掉，OFFSET 建立在一个已经变短的集合上 → **跳行**；而干跑时集合又不变，
     * OFFSET=0 会反复取回同一批 → 死循环。id 游标对两者都稳定。
     *
     * @param afterId 只取 id 严格大于它的（首次传 0）
     */
    @Select("""
            SELECT m.id AS id,
                   m.title AS title,
                   m.year AS year,
                   (SELECT COUNT(*) FROM episode ep WHERE ep.media_id = m.id) AS episodeCount,
                   CASE WHEN EXISTS (SELECT 1 FROM media_collection c WHERE c.media_id = m.id)
                          OR EXISTS (SELECT 1 FROM media_tag t WHERE t.media_id = m.id)
                          OR EXISTS (SELECT 1 FROM episode ep2 WHERE ep2.media_id = m.id)
                          OR EXISTS (SELECT 1 FROM title_mapping tm WHERE tm.media_id = m.id)
                          OR EXISTS (SELECT 1 FROM highlight_project hp WHERE hp.media_id = m.id)
                        THEN 1 ELSE 0 END AS hasRefs,
                   CASE WHEN (m.note IS NOT NULL AND m.note <> '')
                          OR m.rating IS NOT NULL
                          OR (m.aliases IS NOT NULL AND m.aliases <> '')
                          OR m.subcategory_id IS NOT NULL
                          OR m.season > 1
                          OR m.media_format <> 'VIDEO'
                          OR (m.status IS NOT NULL AND m.status <> 'WANT')
                        THEN 1 ELSE 0 END AS hasEdits
              FROM media m
             WHERE m.deleted_at IS NULL
               AND m.id > #{afterId}
               AND NOT EXISTS (SELECT 1 FROM external_work ew WHERE ew.media_id = m.id)
             ORDER BY m.id
             LIMIT #{limit}
            """)
    List<UnlinkedRow> listUnlinked(@Param("limit") int limit, @Param("afterId") long afterId);

    /** 未关联 media 总数（跑之前先知道要跑多久）。 */
    @Select("""
            SELECT COUNT(*) FROM media m
             WHERE m.deleted_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM external_work ew WHERE ew.media_id = m.id)
            """)
    int countUnlinked();

    /** 某个 Bangumi 条目**已在本地关联**到哪条 media（非空 → 该走合并而不是新建）。 */
    @Select("""
            SELECT ew.media_id FROM external_work ew
             WHERE ew.provider = 'BANGUMI' AND ew.external_id = #{externalId} AND ew.media_id IS NOT NULL
             LIMIT 1
            """)
    Long findLinkedMediaId(@Param("externalId") String externalId);

    /**
     * 有本地封面、且**已关联 Bangumi** 的 media —— 这些的本地封面可以删（改走 Bangumi 封面）。
     *
     * <p>刻意**不含**未关联的那些（②③ 人工层）：它们没有 Bangumi 条目，本地封面是**唯一**封面，
     * 删了就是永久无封面（源是 AniList/omofuna，无法重抓）——见设计规格 §6.5。
     */
    @Select("""
            SELECT m.id AS id, m.cover_path AS coverPath FROM media m
             WHERE m.deleted_at IS NULL AND m.cover_path IS NOT NULL
               AND EXISTS (SELECT 1 FROM external_work ew WHERE ew.media_id = m.id)
             ORDER BY m.id
            """)
    List<LinkedCover> listLinkedCovers();

    record LinkedCover(long id, String coverPath) {
    }

    /**
     * 对账要处理的一行（未关联 media + 两个判定标志）。
     *
     * @param episodeCount 本地集数（空 = 未知）；多候选精确同名时用来消歧
     */
    record UnlinkedRow(long id, String title, Integer year, Integer episodeCount,
                       boolean hasRefs, boolean hasEdits) {
    }
}
