package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.MediaTagMapper;
import com.videotagger.mapper.TagMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 标签写入口（v0.31 标签重做后的**唯一真源**）：`clip_tag` / `episode_tag` / `media_tag` 三张关联表。
 *
 * <p>两条铁律：
 * <ol>
 *   <li><b>受控</b>：只接受**已存在**的 {@code tagId}，打标**绝不新建词条**（新建只能走 {@code POST /api/tags}）；
 *       不存在的 id 直接 400。</li>
 *   <li><b>不互通</b>：三级之间**不做任何向上并集落库**（旧的 {@code TagSyncService} 已删除）。
 *       媒体视角需要"媒体/集/片段任一层命中"的效果，一律在**查询期**做并集（见 {@code MediaMapper.TAG_UNION}）。</li>
 * </ol>
 *
 * <p>{@code Clip.tag / tagIds / tagNames} 是**派生只读**字段：由本类的 {@link #decorate} 从 {@code clip_tag} 回填，
 * 任何写入都不得直接 set（{@code clips.tag} 字符串列已在 V44 删除）。
 */
@Service
public class TagLinkService {

    private final TagMapper tagMapper;
    private final MediaTagMapper mediaTagMapper;
    private final EpisodeTagMapper episodeTagMapper;
    private final ClipTagMapper clipTagMapper;
    private final EmbeddingTaskService embeddingTaskService;

    public TagLinkService(TagMapper tagMapper, MediaTagMapper mediaTagMapper,
                          EpisodeTagMapper episodeTagMapper, ClipTagMapper clipTagMapper,
                          EmbeddingTaskService embeddingTaskService) {
        this.tagMapper = tagMapper;
        this.mediaTagMapper = mediaTagMapper;
        this.episodeTagMapper = episodeTagMapper;
        this.clipTagMapper = clipTagMapper;
        this.embeddingTaskService = embeddingTaskService;
    }

    // ---------- 受控校验 ----------

    /** 全部 tagId 必须已存在于词表；重复 id 自动去重。不存在 → 400（前端会引导去新建词条）。 */
    public List<Long> validate(List<Long> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return List.of();
        }
        List<Long> ids = tagIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        List<Tag> found = tagMapper.selectBatchIds(ids);
        if (found.size() != ids.size()) {
            Set<Long> ok = new HashSet<>();
            for (Tag t : found) {
                ok.add(t.getId());
            }
            List<Long> bad = ids.stream().filter(id -> !ok.contains(id)).toList();
            throw new IllegalArgumentException("标签不存在（词库受控，不能自动新建）：" + bad);
        }
        return ids;
    }

    // ---------- 写入 ----------

    /** **全量替换**某片段的标签（保存 / 编辑片段用），并触发片段重嵌入。 */
    @Transactional
    public void setClipTags(long clipId, List<Long> tagIds) {
        List<Long> ids = validate(tagIds);
        clipTagMapper.deleteByClip(clipId);
        for (Long tagId : ids) {
            clipTagMapper.insertIgnore(clipId, tagId);
        }
        embeddingTaskService.enqueue(EntityType.CLIP, clipId);
    }

    /** 追加标签（详情页「＋添加标签」/ 批量打标用），幂等。 */
    @Transactional
    public void addTags(EntityType type, long entityId, List<Long> tagIds) {
        List<Long> ids = validate(tagIds);
        if (ids.isEmpty()) {
            return;
        }
        for (Long tagId : ids) {
            switch (type) {
                case MEDIA -> mediaTagMapper.insertIgnore(entityId, tagId);
                case EPISODE -> episodeTagMapper.insertIgnore(entityId, tagId);
                case CLIP -> clipTagMapper.insertIgnore(entityId, tagId);
            }
        }
        embeddingTaskService.enqueue(type, entityId);
    }

    /** 移除单个标签（幂等），并触发重嵌入。 */
    @Transactional
    public void removeTag(EntityType type, long entityId, long tagId) {
        switch (type) {
            case MEDIA -> mediaTagMapper.deleteLink(entityId, tagId);
            case EPISODE -> episodeTagMapper.deleteLink(entityId, tagId);
            case CLIP -> clipTagMapper.deleteLink(entityId, tagId);
        }
        embeddingTaskService.enqueue(type, entityId);
    }

    /**
     * 批量打标 / 移除（媒体页勾选模式用；一次事务 + 幂等）。
     *
     * <p>返回值 = **真实变更行数**（新增/删除真正生效的关联数），不是“遍历过几部媒体”：
     * 否则「从这些媒体移除」在本来就没打这个词时也会报“已移除 N 部”，是骗人的。
     */
    @Transactional
    public int batchMediaTags(List<Long> mediaIds, List<Long> tagIds, String action) {
        if (mediaIds == null || mediaIds.isEmpty()) {
            return 0;
        }
        List<Long> ids = validate(tagIds);
        if (ids.isEmpty()) {
            return 0;
        }
        boolean remove = "remove".equalsIgnoreCase(action == null ? "" : action.trim());
        List<Long> targets = mediaIds.stream().filter(Objects::nonNull).distinct().toList();
        int changed = 0;
        for (Long mediaId : targets) {
            boolean touchedEntity = false;
            for (Long tagId : ids) {
                int affected = remove
                        ? mediaTagMapper.deleteLink(mediaId, tagId)
                        : mediaTagMapper.insertIgnore(mediaId, tagId);
                changed += affected;
                touchedEntity = touchedEntity || affected > 0;
            }
            // 只有真动了关联才重嵌（全 no-op 的媒体不必重算向量）
            if (touchedEntity) {
                embeddingTaskService.enqueue(EntityType.MEDIA, mediaId);
            }
        }
        return changed;
    }

    /** 某实体自己挂的标签 id（**实体视角**，不含下级）。 */
    public List<Long> tagIdsOf(EntityType type, long entityId) {
        List<Tag> tags = switch (type) {
            case MEDIA -> mediaTagMapper.selectTags(entityId);
            case EPISODE -> episodeTagMapper.selectTags(entityId);
            case CLIP -> clipTagMapper.selectTags(entityId);
        };
        return tags.stream().map(Tag::getId).toList();
    }

    // ---------- 派生展示（Clip.tag / tagIds / tagNames） ----------

    /** 批量回填片段标签（一次 SQL）。空输入直接返回。 */
    public void decorate(List<Clip> clips) {
        if (clips == null || clips.isEmpty()) {
            return;
        }
        List<Long> ids = clips.stream().map(Clip::getId).filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<Long, List<TagMapper.ClipTagName>> byClip = new HashMap<>();
        for (TagMapper.ClipTagName row : tagMapper.namesByClipIds(ids)) {
            byClip.computeIfAbsent(row.clipId(), k -> new ArrayList<>()).add(row);
        }
        for (Clip c : clips) {
            applyRows(c, byClip.get(c.getId()));
        }
    }

    /** 单个片段回填。 */
    public void decorate(Clip clip) {
        if (clip == null) {
            return;
        }
        decorate(List.of(clip));
    }

    /** 已知标签名时直接装配（推荐渲染 / 搜索结果这类自己批量查过的场景）。 */
    public static void apply(Clip clip, List<String> names) {
        List<String> list = names == null ? List.of() : names;
        clip.setTagNames(list);
        clip.setTag(String.join(" ", list));
    }

    private static void applyRows(Clip clip, List<TagMapper.ClipTagName> rows) {
        if (rows == null || rows.isEmpty()) {
            clip.setTagIds(List.of());
            apply(clip, List.of());
            return;
        }
        List<TagMapper.ClipTagName> sorted = new ArrayList<>(rows);
        sorted.sort(Comparator.comparing(TagMapper.ClipTagName::tagId));
        clip.setTagIds(sorted.stream().map(TagMapper.ClipTagName::tagId).toList());
        apply(clip, sorted.stream().map(TagMapper.ClipTagName::name).toList());
    }
}
