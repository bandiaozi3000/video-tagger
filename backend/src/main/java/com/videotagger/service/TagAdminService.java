package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.MediaTagMapper;
import com.videotagger.mapper.TagMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

/** 标签池管理：列表/改名/合并/删孤儿。改名与合并必须同步 clips.tag 冗余列并触发引用实体重嵌。 */
@Service
public class TagAdminService {

    private final TagMapper tagMapper;
    private final MediaTagMapper mediaTagMapper;
    private final EpisodeTagMapper episodeTagMapper;
    private final ClipTagMapper clipTagMapper;
    private final ClipMapper clipMapper;
    private final EmbeddingTaskService embeddingTaskService;

    public TagAdminService(TagMapper tagMapper, MediaTagMapper mediaTagMapper,
                           EpisodeTagMapper episodeTagMapper, ClipTagMapper clipTagMapper,
                           ClipMapper clipMapper, EmbeddingTaskService embeddingTaskService) {
        this.tagMapper = tagMapper;
        this.mediaTagMapper = mediaTagMapper;
        this.episodeTagMapper = episodeTagMapper;
        this.clipTagMapper = clipTagMapper;
        this.clipMapper = clipMapper;
        this.embeddingTaskService = embeddingTaskService;
    }

    /** 标签列表：q 按名过滤；mediaId != null 时按媒体维度返回；统一分页（内存切片，词条量级小）。 */
    public PageResult<TagUsage> list(String q, Long mediaId, int page, int size) {
        List<TagUsage> all = mediaId != null
                ? tagMapper.countByMedia(mediaId)
                : tagMapper.countGlobal();
        String query = q == null ? "" : q.trim().toLowerCase();
        List<TagUsage> filtered = query.isEmpty() ? all
                : all.stream().filter(u -> u.name().toLowerCase().contains(query)).toList();
        if (page < 1) page = 1;
        if (size < 1) size = 50;
        int from = Math.min((page - 1) * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        return new PageResult<>(new ArrayList<>(filtered.subList(from, to)), filtered.size());
    }

    /** 改名：更新词条 + 同步 clips.tag 冗余列 + 引用实体重嵌。新名撞既有词条 → 拒绝（引导合并）。 */
    @Transactional
    public TagUsage rename(Long id, String newName) {
        Tag tag = tagMapper.selectById(id);
        if (tag == null) {
            throw new NoSuchElementException("标签不存在: " + id);
        }
        String n = newName == null ? "" : newName.trim();
        if (n.isEmpty()) {
            throw new IllegalArgumentException("标签名不能为空");
        }
        Tag dup = tagMapper.selectByName(n);
        if (dup != null && !dup.getId().equals(id)) {
            throw new IllegalArgumentException("已存在同名标签「" + n + "」，请改用合并");
        }
        String old = tag.getName();
        if (old.equals(n)) {
            return toUsage(tag);
        }
        tag.setName(n);
        tagMapper.updateById(tag);
        List<Long> mediaIds = tagMapper.mediaIdsByTag(id);
        List<Long> episodeIds = tagMapper.episodeIdsByTag(id);
        List<Long> clipIds = new ArrayList<>(tagMapper.clipIdsByTag(id));
        clipIds.addAll(rewriteClipTags(old, n));
        reembed(mediaIds, episodeIds, clipIds);
        return toUsage(tag);
    }

    /** 合并：from 引用迁移到 to（三级关联 + clips.tag 冗余列），删 from 词条，重嵌涉及实体。 */
    @Transactional
    public void merge(Long fromId, Long toId) {
        if (fromId == null || toId == null) {
            throw new IllegalArgumentException("合并参数不完整");
        }
        if (fromId.equals(toId)) {
            throw new IllegalArgumentException("源标签与目标标签不能相同");
        }
        Tag from = tagMapper.selectById(fromId);
        Tag to = tagMapper.selectById(toId);
        if (from == null || to == null) {
            throw new IllegalArgumentException("标签不存在");
        }
        // 迁移前收集 from/to 引用实体（重嵌用）
        List<Long> mediaIds = mergeIds(tagMapper.mediaIdsByTag(fromId), tagMapper.mediaIdsByTag(toId));
        List<Long> episodeIds = mergeIds(tagMapper.episodeIdsByTag(fromId), tagMapper.episodeIdsByTag(toId));
        List<Long> clipIds = mergeIds(tagMapper.clipIdsByTag(fromId), tagMapper.clipIdsByTag(toId));
        // 三级关联引用迁移（INSERT IGNORE 防重复，再清源）
        mediaTagMapper.moveRefs(fromId, toId);
        mediaTagMapper.deleteRefs(fromId);
        episodeTagMapper.moveRefs(fromId, toId);
        episodeTagMapper.deleteRefs(fromId);
        clipTagMapper.moveRefs(fromId, toId);
        clipTagMapper.deleteRefs(fromId);
        // clips.tag 冗余列同步（影响到的 clip 一并重嵌）
        clipIds.addAll(rewriteClipTags(from.getName(), to.getName()));
        // 删源词条
        tagMapper.deleteById(fromId);
        reembed(mediaIds, episodeIds, clipIds);
    }

    /** 删孤儿：仅三级引用全 0 允许，否则拒绝。 */
    @Transactional
    public void delete(Long id) {
        Tag tag = tagMapper.selectById(id);
        if (tag == null) {
            return;
        }
        if (tagMapper.countRefs(id) > 0) {
            throw new IllegalArgumentException("标签仍被引用，不能删除");
        }
        tagMapper.deleteById(id);
    }

    /** 新增词条：仅建词库条目（无引用），打标补全即可见；同名已存在则拒绝。 */
    @Transactional
    public TagUsage add(String name) {
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) {
            throw new IllegalArgumentException("标签名不能为空");
        }
        Tag dup = tagMapper.selectByName(n);
        if (dup != null) {
            throw new IllegalArgumentException("已存在同名标签「" + n + "」");
        }
        tagMapper.insertIgnore(n, System.currentTimeMillis());
        return toUsage(tagMapper.selectByName(n));
    }

    /** 批量删孤儿：先全部校验引用（任一被引用整体拒绝），再逐个删除。 */
    @Transactional
    public void deleteBatch(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        for (Long id : ids) {
            if (tagMapper.countRefs(id) > 0) {
                Tag t = tagMapper.selectById(id);
                throw new IllegalArgumentException("标签「" + (t != null ? t.getName() : id) + "」仍被引用，不能删除");
            }
        }
        for (Long id : ids) {
            tagMapper.deleteById(id);
        }
    }

    /** clips.tag 按空白分词精确替换旧词 → 新词（避免子串误伤），返回受影响的 clip id。 */
    private List<Long> rewriteClipTags(String old, String nw) {
        List<Long> affected = new ArrayList<>();
        if (old == null || old.isEmpty() || nw == null) {
            return affected;
        }
        for (Clip c : clipMapper.selectByTagContains(old)) {
            String tag = c.getTag();
            if (tag == null || !tag.contains(old)) {
                continue;
            }
            List<String> tokens = new ArrayList<>();
            for (String tok : tag.trim().split("\\s+")) {
                if (tok.isEmpty()) {
                    continue;
                }
                tokens.add(tok.equals(old) ? nw : tok);
            }
            String updated = String.join(" ", tokens);
            if (!updated.equals(tag)) {
                clipMapper.updateTag(c.getId(), updated);
                affected.add(c.getId());
            }
        }
        return affected;
    }

    private void reembed(List<Long> mediaIds, List<Long> episodeIds, List<Long> clipIds) {
        for (Long m : mediaIds) {
            embeddingTaskService.enqueue(EntityType.MEDIA, m);
        }
        for (Long e : episodeIds) {
            embeddingTaskService.enqueue(EntityType.EPISODE, e);
        }
        for (Long c : clipIds) {
            embeddingTaskService.enqueue(EntityType.CLIP, c);
        }
    }

    private static List<Long> mergeIds(List<Long> a, List<Long> b) {
        Set<Long> set = new LinkedHashSet<>();
        set.addAll(a);
        set.addAll(b);
        return new ArrayList<>(set);
    }

    private static TagUsage toUsage(Tag t) {
        return new TagUsage(t.getId(), t.getName(), t.getCreatedAt(), 0, 0, 0, 0);
    }
}
