package com.videotagger.service;

import com.videotagger.entity.Anime;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.AnimeCollectionMapper;
import com.videotagger.mapper.AnimeMapper;
import com.videotagger.mapper.AnimeTagMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.TagMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class AnimeService {

    private static final List<String> TYPES = List.of("ANIME", "MOVIE");
    private static final List<String> STATUSES = List.of("WANT", "WATCHING", "DONE", "PAUSED", "DROPPED");

    private final AnimeMapper animeMapper;
    private final EpisodeMapper episodeMapper;
    private final AnimeTagMapper animeTagMapper;
    private final EpisodeTagMapper episodeTagMapper;
    private final ClipTagMapper clipTagMapper;
    private final ClipMapper clipMapper;
    private final TagMapper tagMapper;
    private final AnimeCollectionMapper animeCollectionMapper;
    private final EmbeddingTaskService embeddingTaskService;

    public AnimeService(AnimeMapper animeMapper, EpisodeMapper episodeMapper,
                        AnimeTagMapper animeTagMapper, EpisodeTagMapper episodeTagMapper,
                        ClipTagMapper clipTagMapper, ClipMapper clipMapper,
                        TagMapper tagMapper, AnimeCollectionMapper animeCollectionMapper,
                        EmbeddingTaskService embeddingTaskService) {
        this.animeMapper = animeMapper;
        this.episodeMapper = episodeMapper;
        this.animeTagMapper = animeTagMapper;
        this.episodeTagMapper = episodeTagMapper;
        this.clipTagMapper = clipTagMapper;
        this.clipMapper = clipMapper;
        this.tagMapper = tagMapper;
        this.animeCollectionMapper = animeCollectionMapper;
        this.embeddingTaskService = embeddingTaskService;
    }

    /** 番剧卡片墙：支持状态/类型/待确认筛选。 */
    public List<AnimeSummary> list(int limit, String status, String type, Integer confirmed, String sort) {
        return animeMapper.listFiltered(status, type, confirmed, sort, Math.min(Math.max(limit, 1), 100));
    }

    /** 最近观看：打过标记即算，按最新标记时间倒序。 */
    public List<AnimeSummary> recent(int limit) {
        return animeMapper.listByLatest(Math.min(Math.max(limit, 1), 100));
    }

    public AnimeDetail get(Long id) {
        Anime a = requireAnime(id);
        long clipCount = clipMapper.countByAnime(id);
        long episodeCount = episodeMapper.countByAnime(id);
        return new AnimeDetail(a.getId(), a.getTitle(), a.getAliases(), a.getType(), a.getStatus(),
                a.getRating(), a.getCoverPath(), a.getConfirmed(), a.getCreatedAt(),
                clipCount, episodeCount, animeTagMapper.selectTags(id),
                animeCollectionMapper.selectCollectionIdsByAnime(id));
    }

    @Transactional
    public Anime create(AnimeRequest req) {
        Anime a = new Anime();
        apply(a, req);
        a.setConfirmed(1); // 手动创建即已确认
        a.setCreatedAt(System.currentTimeMillis());
        animeMapper.insert(a);
        embeddingTaskService.enqueue(EntityType.ANIME, a.getId());
        return a;
    }

    @Transactional
    public Anime update(Long id, AnimeRequest req) {
        Anime a = requireAnime(id);
        apply(a, req);
        animeMapper.updateById(a);
        embeddingTaskService.enqueue(EntityType.ANIME, id);
        return a;
    }

    @Transactional
    public Anime rename(Long id, String title) {
        Anime a = requireAnime(id);
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title 不能为空");
        }
        a.setTitle(title.trim());
        animeMapper.updateById(a);
        embeddingTaskService.enqueue(EntityType.ANIME, id);
        return a;
    }

    /** 手工确认：自动识别为低置信的番剧经审核后置 confirmed=1。 */
    @Transactional
    public Anime confirm(Long id) {
        Anime a = requireAnime(id);
        a.setConfirmed(1);
        animeMapper.updateById(a);
        return a;
    }

    /** 合并：把 fromId 的集全部移到 intoId，标签合并去重，然后删除 fromId 档案。 */
    @Transactional
    public void merge(Long fromId, Long intoId) {
        Anime from = requireAnime(fromId);
        requireAnime(intoId);
        for (Episode ep : episodeMapper.listByAnime(fromId)) {
            ep.setAnimeId(intoId);
            episodeMapper.updateById(ep);
        }
        for (Tag t : animeTagMapper.selectTags(fromId)) {
            animeTagMapper.insertIgnore(intoId, t.getId());
        }
        animeTagMapper.deleteByAnime(fromId);
        animeCollectionMapper.deleteByAnime(fromId);
        embeddingTaskService.deleteFor(EntityType.ANIME, from.getId());
        animeMapper.deleteById(from.getId());
        // 合并后目标番剧的文本变化，重嵌入
        embeddingTaskService.enqueue(EntityType.ANIME, intoId);
        for (Episode ep : episodeMapper.listByAnime(intoId)) {
            embeddingTaskService.enqueue(EntityType.EPISODE, ep.getId());
        }
    }

    /** 删除番剧：级联删除其下所有集、片段及其标签/向量/任务。 */
    @Transactional
    public void delete(Long id) {
        Anime a = requireAnime(id);
        for (Episode ep : episodeMapper.listByAnime(id)) {
            for (Clip c : clipMapper.listByEpisode(ep.getId())) {
                embeddingTaskService.deleteFor(EntityType.CLIP, c.getId());
                clipTagMapper.deleteByClip(c.getId());
            }
            clipMapper.deleteByEpisode(ep.getId());
            episodeTagMapper.deleteByEpisode(ep.getId());
            embeddingTaskService.deleteFor(EntityType.EPISODE, ep.getId());
            episodeMapper.deleteById(ep.getId());
        }
        animeTagMapper.deleteByAnime(id);
        animeCollectionMapper.deleteByAnime(id);
        embeddingTaskService.deleteFor(EntityType.ANIME, a.getId());
        animeMapper.deleteById(a.getId());
    }

    /** 某番剧的集列表（带片段数/集级标签）。 */
    public List<EpisodeDetail> episodes(Long animeId) {
        requireAnime(animeId);
        return episodeMapper.listSummariesByAnime(animeId).stream()
                .map(s -> EpisodeDetail.from(s, episodeTagMapper.selectTags(s.id())))
                .toList();
    }

    public void addTag(Long animeId, String tagName) {
        requireAnime(animeId);
        Tag tag = ensureTag(tagName);
        if (tag != null) {
            animeTagMapper.insertIgnore(animeId, tag.getId());
            embeddingTaskService.enqueue(EntityType.ANIME, animeId);
        }
    }

    public void removeTag(Long animeId, Long tagId) {
        requireAnime(animeId);
        animeTagMapper.deleteLink(animeId, tagId);
        embeddingTaskService.enqueue(EntityType.ANIME, animeId);
    }

    private Anime requireAnime(Long id) {
        Anime a = animeMapper.selectById(id);
        if (a == null) {
            throw new NoSuchElementException("anime not found: " + id);
        }
        return a;
    }

    private Tag ensureTag(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        tagMapper.insertIgnore(trimmed, System.currentTimeMillis());
        return tagMapper.selectByName(trimmed);
    }

    private void apply(Anime a, AnimeRequest req) {
        a.setTitle(req.title());
        a.setType(TYPES.contains(req.type()) ? req.type() : "ANIME");
        a.setStatus(STATUSES.contains(req.status()) ? req.status() : "WANT");
        a.setRating(req.rating());
    }
}
