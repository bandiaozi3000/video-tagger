package com.videotagger.reconcile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Media;
import com.videotagger.entity.MediaEntry;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.HighlightProjectItemMapper;
import com.videotagger.mapper.HighlightProjectMapper;
import com.videotagger.mapper.MediaCollectionMapper;
import com.videotagger.mapper.MediaEntryMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaReconcileMapper;
import com.videotagger.mapper.MediaTagMapper;
import com.videotagger.mapper.TitleMappingMapper;
import com.videotagger.metadata.MetadataSyncCommitService;
import com.videotagger.metadata.SyncCommitRequest;
import com.videotagger.metadata.SyncCommitResult;
import com.videotagger.service.CoverService;
import com.videotagger.service.MediaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 媒体库对账的**执行器**：把 {@link ReconcileDecision} 变成真实动作。干跑与真跑走同一套代码，
 * 只由 {@code dryRun} 决定写不写 —— 这样「干跑报告」与「真跑结果」不会漂移。
 *
 * <p><b>三类动作</b>（设计规格 §5）：
 * <ul>
 *   <li>{@code LINK}（未在本地关联）：直接复用 {@link MetadataSyncCommitService#commit} 的
 *       {@code LINK} 动作把外部条目挂到**已存在**的 media 上 —— 不自己写一套 external_work，
 *       语义与「同步番剧」弹窗完全一致，也不会碰 media 的标题/年份/备注/评分/封面。</li>
 *   <li>{@code MERGE}（命中的条目本地已关联到 B）：把 A 的引用与人工信息**以本地为主**搬到 B，再物理删 A。</li>
 *   <li>{@code PURGE}：物理删 A（先过引用检查）。</li>
 * </ul>
 *
 * <p>⚠️ {@link MediaService#purge} 会级联清 episode/clips/标签/向量/external_work/封面，
 * 但**漏删 {@code media_entry}**（1:1 结构子表，实测库里已攒了 33 条孤儿）——本类用
 * {@link #purgeDeep} 补上。
 */
@Service
public class MediaReconcileExecutor {

    private static final Logger log = LoggerFactory.getLogger(MediaReconcileExecutor.class);

    private final MediaMapper mediaMapper;
    private final MediaService mediaService;
    private final MetadataSyncCommitService commitService;
    private final MediaEntryMapper mediaEntryMapper;
    private final MediaCollectionMapper mediaCollectionMapper;
    private final MediaTagMapper mediaTagMapper;
    private final EpisodeMapper episodeMapper;
    private final TitleMappingMapper titleMappingMapper;
    private final HighlightProjectMapper highlightProjectMapper;
    private final HighlightProjectItemMapper highlightProjectItemMapper;
    private final MediaReconcileMapper reconcileMapper;
    private final CoverService coverService;

    public MediaReconcileExecutor(MediaMapper mediaMapper, MediaService mediaService,
                                  MetadataSyncCommitService commitService,
                                  MediaEntryMapper mediaEntryMapper,
                                  MediaCollectionMapper mediaCollectionMapper,
                                  MediaTagMapper mediaTagMapper,
                                  EpisodeMapper episodeMapper,
                                  TitleMappingMapper titleMappingMapper,
                                  HighlightProjectMapper highlightProjectMapper,
                                  HighlightProjectItemMapper highlightProjectItemMapper,
                                  MediaReconcileMapper reconcileMapper,
                                  CoverService coverService) {
        this.mediaMapper = mediaMapper;
        this.mediaService = mediaService;
        this.commitService = commitService;
        this.mediaEntryMapper = mediaEntryMapper;
        this.mediaCollectionMapper = mediaCollectionMapper;
        this.mediaTagMapper = mediaTagMapper;
        this.episodeMapper = episodeMapper;
        this.titleMappingMapper = titleMappingMapper;
        this.highlightProjectMapper = highlightProjectMapper;
        this.highlightProjectItemMapper = highlightProjectItemMapper;
        this.reconcileMapper = reconcileMapper;
        this.coverService = coverService;
    }

    /**
     * 执行结果。
     *
     * @param applied    干跑时恒为 false（只报告不写）
     * @param overwritten 合并时**覆盖掉的字段**（以本地为主），供用户复核
     * @param reason     跳过/失败的原因；成功时为动作描述
     */
    public record ExecResult(long mediaId, ReconcileAction action, boolean applied,
                             String reason, List<String> overwritten) {
    }

    /** 执行一条判定。{@code dryRun=true} 时只做检查与预告，不写任何表。 */
    public ExecResult execute(ReconcileDecision decision, boolean dryRun) {
        return switch (decision.action()) {
            case PURGE -> purge(decision, dryRun);
            case AUTO -> decision.linkedMediaId() == null
                    ? link(decision, dryRun)
                    : merge(decision, dryRun);
            default -> new ExecResult(decision.mediaId(), decision.action(), false,
                    "人工层，执行器不动", List.of());
        };
    }

    // ---------- LINK ----------

    private ExecResult link(ReconcileDecision d, boolean dryRun) {
        if (dryRun) {
            return new ExecResult(d.mediaId(), d.action(), false,
                    "将新建关联 → Bangumi " + d.externalId() + "「" + d.matchedTitle() + "」", List.of());
        }
        // 复用既有 commit 链路：LINK = 挂到已存在的 media，不动 media 字段
        SyncCommitResult result = commitService.commit(new SyncCommitRequest(
                List.of(new SyncCommitRequest.Item(d.externalId(), "LINK", d.mediaId()))));
        if (result.failed() > 0) {
            String error = result.items().stream()
                    .filter(i -> "FAILED".equals(i.status()))
                    .map(SyncCommitResult.ItemResult::error)
                    .filter(Objects::nonNull).findFirst().orElse("未知错误");
            return new ExecResult(d.mediaId(), d.action(), false, "关联失败: " + error, List.of());
        }
        return new ExecResult(d.mediaId(), d.action(), true,
                "已关联 Bangumi " + d.externalId() + "（" + (result.added() > 0 ? "新增" : "更新") + "）", List.of());
    }

    // ---------- MERGE（A → B） ----------

    private ExecResult merge(ReconcileDecision d, boolean dryRun) {
        long a = d.mediaId();
        Long b = d.linkedMediaId();
        Media target = b == null ? null : mediaMapper.selectById(b);
        if (target == null) {
            return new ExecResult(a, d.action(), false, "目标 media " + b + " 不存在，跳过", List.of());
        }
        Media source = mediaMapper.selectById(a);
        if (source == null) {
            return new ExecResult(a, d.action(), false, "源 media 已不存在，跳过", List.of());
        }
        // 集一旦存在就不自动合（集号冲突要人看），这是唯一拒绝合并的情形
        List<Episode> episodes = episodeMapper.listByMedia(a);
        if (!episodes.isEmpty()) {
            return new ExecResult(a, d.action(), false,
                    "源有 " + episodes.size() + " 集，集号可能冲突 → 交人工", List.of());
        }
        List<String> overwritten = planOverwrite(source, target);

        if (dryRun) {
            return new ExecResult(a, d.action(), false,
                    "将合并进 media " + b + "「" + target.getTitle() + "」"
                            + (overwritten.isEmpty() ? "" : "，覆盖字段: " + String.join(",", overwritten)),
                    overwritten);
        }

        // 1. 收藏夹：先搬到目标（insertIgnore 天然去重），再清源的
        for (Long collectionId : mediaCollectionMapper.selectCollectionIdsByMedia(a)) {
            mediaCollectionMapper.insertIgnore(b, collectionId);
        }
        mediaCollectionMapper.deleteByMedia(a);

        // 2. 标签：同上
        for (Tag tag : mediaTagMapper.selectTags(a)) {
            mediaTagMapper.insertIgnore(b, tag.getId());
        }
        mediaTagMapper.deleteByMedia(a);

        // 3. 文件名映射 / 混剪工程：改指（这两张表全局只有个位数，直接改）
        titleMappingMapper.update(null, new LambdaUpdateWrapper<com.videotagger.entity.TitleMapping>()
                .eq(com.videotagger.entity.TitleMapping::getMediaId, a)
                .set(com.videotagger.entity.TitleMapping::getMediaId, b));
        highlightProjectMapper.update(null, new LambdaUpdateWrapper<com.videotagger.entity.HighlightProject>()
                .eq(com.videotagger.entity.HighlightProject::getMediaId, a)
                .set(com.videotagger.entity.HighlightProject::getMediaId, b));

        // 4. 字段以本地为主覆盖目标
        applyOverwrite(source, target, overwritten);

        // 5. 物理删源（含 media_entry）
        purgeDeep(a);
        return new ExecResult(a, d.action(), true,
                "已合并进 media " + b + "「" + target.getTitle() + "」"
                        + (overwritten.isEmpty() ? "" : "，覆盖: " + String.join(",", overwritten)),
                overwritten);
    }

    /** 算出「以本地为主」会覆盖目标哪些字段；只算不写，干跑与真跑共用同一份判断。 */
    private List<String> planOverwrite(Media source, Media target) {
        List<String> out = new ArrayList<>();
        if (notBlank(source.getNote()) && !Objects.equals(source.getNote(), target.getNote())) {
            out.add("note");
        }
        if (source.getRating() != null && !Objects.equals(source.getRating(), target.getRating())) {
            out.add("rating");
        }
        if (notBlank(source.getAliases()) && !Objects.equals(source.getAliases(), target.getAliases())) {
            out.add("aliases");
        }
        if (source.getSubcategoryId() != null && !Objects.equals(source.getSubcategoryId(), target.getSubcategoryId())) {
            out.add("subcategory");
        }
        if (source.getSeason() != null && !Objects.equals(source.getSeason(), target.getSeason())) {
            out.add("season");
        }
        if (Boolean.TRUE.equals(source.getAllowHardsub()) && !Boolean.TRUE.equals(target.getAllowHardsub())) {
            out.add("allowHardsub");
        }
        return out;
    }

    private void applyOverwrite(Media source, Media target, List<String> fields) {
        if (fields.isEmpty()) {
            return;
        }
        if (fields.contains("note")) {
            target.setNote(source.getNote());
        }
        if (fields.contains("rating")) {
            target.setRating(source.getRating());
        }
        if (fields.contains("aliases")) {
            target.setAliases(source.getAliases());
        }
        if (fields.contains("subcategory")) {
            target.setSubcategoryId(source.getSubcategoryId());
            target.setSubcategory(source.getSubcategory());
        }
        if (fields.contains("season")) {
            target.setSeason(source.getSeason());
        }
        if (fields.contains("allowHardsub")) {
            target.setAllowHardsub(Boolean.TRUE);
        }
        mediaMapper.updateById(target);
        log.info("对账合并覆盖：media {} ← {} 的 {}", target.getId(), source.getId(), fields);
    }

    // ---------- PURGE ----------

    private ExecResult purge(ReconcileDecision d, boolean dryRun) {
        long a = d.mediaId();
        if (mediaMapper.selectById(a) == null) {
            return new ExecResult(a, d.action(), false, "已不存在，跳过", List.of());
        }
        if (dryRun) {
            return new ExecResult(a, d.action(), false, "将物理删除（" + d.note() + "）", List.of());
        }
        purgeDeep(a);
        return new ExecResult(a, d.action(), true, "已物理删除", List.of());
    }

    /**
     * 物理删 media，并**补上 {@link MediaService#purge} 没管的三张表**：
     *
     * <ol>
     *   <li>{@code media_entry}：1:1 结构子表，purge 漏删（实测库里已攒 33 条孤儿）</li>
     *   <li>{@code title_mapping}：文件名→媒体的映射，媒体没了就没意义 → 直接删行</li>
     *   <li>{@code highlight_project}：{@code media_id} 是 **NOT NULL**，没法解绑；
     *       **只删条目数为 0 的空壳**（实测引用未关联媒体的两个工程都是 0 条），
     *       有内容的工程不碰（那里面有你的剪辑劳动）</li>
     * </ol>
     */
    public void purgeDeep(long mediaId) {
        mediaEntryMapper.delete(new LambdaQueryWrapper<MediaEntry>().eq(MediaEntry::getMediaId, mediaId));
        titleMappingMapper.delete(new LambdaQueryWrapper<com.videotagger.entity.TitleMapping>()
                .eq(com.videotagger.entity.TitleMapping::getMediaId, mediaId));
        deleteEmptyHighlightProjects(mediaId);
        mediaService.purge(mediaId);
    }

    /** 删掉挂着该 media 且**没有条目**的混剪工程；有条目的保留并记一笔。 */
    private void deleteEmptyHighlightProjects(long mediaId) {
        List<com.videotagger.entity.HighlightProject> projects = highlightProjectMapper.selectList(
                new LambdaQueryWrapper<com.videotagger.entity.HighlightProject>()
                        .eq(com.videotagger.entity.HighlightProject::getMediaId, mediaId));
        for (com.videotagger.entity.HighlightProject project : projects) {
            long items = highlightProjectItemMapper.selectCount(
                    new LambdaQueryWrapper<com.videotagger.entity.HighlightProjectItem>()
                            .eq(com.videotagger.entity.HighlightProjectItem::getProjectId, project.getId()));
            if (items == 0) {
                highlightProjectMapper.deleteById(project.getId());
            } else {
                log.warn("对账：混剪工程 {}（media {}）有 {} 条目，保留不删", project.getId(), mediaId, items);
            }
        }
    }

    // ---------- 收尾清理（与单条判定无关，跑完整批后调一次） ----------

    /**
     * 清掉历史遗留的 {@code media_entry} 孤儿（media 已不存在）。
     *
     * <p>成因：{@link MediaService#purge} 没删这张 1:1 子表，实测库里攒了 33 条。
     *
     * @return 删掉的条数（干跑时返回「将会删掉的条数」）
     */
    public int cleanOrphanMediaEntries(boolean dryRun) {
        List<MediaEntry> all = mediaEntryMapper.selectList(null);
        List<Long> orphans = new ArrayList<>();
        for (MediaEntry entry : all) {
            if (entry.getMediaId() == null || mediaMapper.selectById(entry.getMediaId()) == null) {
                orphans.add(entry.getId());
            }
        }
        if (!dryRun && !orphans.isEmpty()) {
            mediaEntryMapper.deleteBatchIds(orphans);
        }
        return orphans.size();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    /**
     * 删掉「已关联 Bangumi」那些 media 的本地封面文件（用户 2026-09-25 拍板「本地封面全删」）。
     *
     * <p>只删**有 external_work** 的：它们的封面能从 Bangumi 拿到；未关联的 ②③ 层留着，
     * 否则就永久没封面了。删文件的同时把 {@code media.cover_path} 置空，让前端链回落到 Bangumi。
     *
     * <p>⚠️ **不碰** {@code covers/clip/}、{@code covers/ep/}、{@code covers/ext/} ——
     * 那些是片段封面、单集封面与 Bangumi 封面缓存，分属不同子目录。
     *
     * @return 处理的条数（干跑时是「将会删多少」）
     */
    public int deleteCoversOfLinked(boolean dryRun) {
        List<MediaReconcileMapper.LinkedCover> rows = reconcileMapper.listLinkedCovers();
        if (!dryRun) {
            for (MediaReconcileMapper.LinkedCover row : rows) {
                coverService.deleteCover(row.coverPath());
                mediaMapper.clearCover(row.id());
            }
            log.info("对账：已删除 {} 个已关联媒体的本地封面", rows.size());
        }
        return rows.size();
    }
}
