package com.videotagger.service;

import com.videotagger.entity.Media;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.MediaCollectionMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import com.videotagger.mapper.MediaTagMapper;
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
public class MediaService {

    private static final List<String> STATUSES = List.of("WANT", "WATCHING", "DONE", "PAUSED", "DROPPED");

    private final MediaMapper mediaMapper;
    private final EpisodeMapper episodeMapper;
    private final MediaTagMapper mediaTagMapper;
    private final EpisodeTagMapper episodeTagMapper;
    private final ClipTagMapper clipTagMapper;
    private final ClipMapper clipMapper;
    private final TagMapper tagMapper;
    private final MediaCollectionMapper mediaCollectionMapper;
    private final MediaFormatMapper mediaFormatMapper;
    private final MediaSubcategoryMapper mediaSubcategoryMapper;
    private final EmbeddingTaskService embeddingTaskService;
    private final CoverService coverService;

    public MediaService(MediaMapper mediaMapper, EpisodeMapper episodeMapper,
                        MediaTagMapper mediaTagMapper, EpisodeTagMapper episodeTagMapper,
                        ClipTagMapper clipTagMapper, ClipMapper clipMapper,
                        TagMapper tagMapper, MediaCollectionMapper mediaCollectionMapper,
                        MediaFormatMapper mediaFormatMapper, MediaSubcategoryMapper mediaSubcategoryMapper,
                        EmbeddingTaskService embeddingTaskService, CoverService coverService) {
        this.mediaMapper = mediaMapper;
        this.episodeMapper = episodeMapper;
        this.mediaTagMapper = mediaTagMapper;
        this.episodeTagMapper = episodeTagMapper;
        this.clipTagMapper = clipTagMapper;
        this.clipMapper = clipMapper;
        this.tagMapper = tagMapper;
        this.mediaCollectionMapper = mediaCollectionMapper;
        this.mediaFormatMapper = mediaFormatMapper;
        this.mediaSubcategoryMapper = mediaSubcategoryMapper;
        this.embeddingTaskService = embeddingTaskService;
        this.coverService = coverService;
    }

    /** 媒体卡片墙：支持状态/格式/子分类（子树收敛）/待确认/收藏夹/年份/媒体标签筛选；offset 分页。 */
    public List<MediaSummary> list(int limit, int offset, String status, String format, Long subcategoryId,
                                   Integer confirmed, Long collectionId, String sort, Integer year, Long tagId) {
        return mediaMapper.listFiltered(status, format, subcategoryId, confirmed, collectionId, sort, year, tagId,
                Math.min(Math.max(limit, 1), 100), Math.max(offset, 0));
    }

    /** 最近观看：打过标记即算，按最新标记时间倒序；支持 status/format/子分类/confirmed/collectionId/year 筛选；offset 分页。 */
    public List<MediaSummary> recent(int limit, int offset, String status, String format, Long subcategoryId,
                                     Integer confirmed, Long collectionId, Integer year) {
        return mediaMapper.listByLatest(Math.min(Math.max(limit, 1), 100), Math.max(offset, 0),
                status, format, subcategoryId, confirmed, collectionId, year);
    }

    /** 带筛选的媒体总数：全部媒体/收藏夹分支走 countFiltered，最近观看分支（latest=true）走 countLatest。 */
    public long count(String status, String format, Long subcategoryId, Integer confirmed, Long collectionId,
                      Integer year, Long tagId, boolean latest) {
        if (latest) {
            return mediaMapper.countLatest(status, format, subcategoryId, confirmed, collectionId, year);
        }
        return mediaMapper.countFiltered(status, format, subcategoryId, confirmed, collectionId, year, tagId);
    }

    /** 库中已有的全部首播年份（降序）。 */
    public List<Integer> years() {
        return mediaMapper.listDistinctYears();
    }

    /** 补下缺失封面：遍历 cover_url 非空但尚无封面的媒体重新异步下载（异步中断/未下完的可一键补齐），返回触发数量。 */
    public int retryCovers() {
        List<Media> missing = mediaMapper.listMissingCovers();
        for (Media m : missing) {
            coverService.downloadAsync(m.getId(), m.getCoverUrl());
        }
        return missing.size();
    }

    public MediaDetail get(Long id) {
        Media a = requireMedia(id);
        long clipCount = clipMapper.countByMedia(id);
        long episodeCount = episodeMapper.countByMedia(id);
        String fallbackCoverPath = a.getCoverPath() == null
                ? clipMapper.selectRepresentativeCoverByMedia(id) : null;
        return new MediaDetail(a.getId(), a.getTitle(), a.getYear(), a.getOriginalTitle(), a.getAliases(), a.getMediaFormat(),
                a.getSubcategory(), a.getSubcategoryId(), a.getNote(), a.getStatus(), a.getRating(), a.getCoverPath(),
                a.getConfirmed(), a.getCreatedAt(), clipCount, episodeCount, mediaTagMapper.selectTags(id),
                mediaCollectionMapper.selectCollectionIdsByMedia(id), fallbackCoverPath);
    }

    @Transactional
    public Media create(MediaRequest req) {
        Media a = new Media();
        apply(a, req);
        a.setConfirmed(1); // 手动创建即已确认
        a.setCreatedAt(System.currentTimeMillis());
        mediaMapper.insert(a);
        embeddingTaskService.enqueue(EntityType.MEDIA, a.getId());
        return a;
    }

    @Transactional
    public Media update(Long id, MediaRequest req) {
        Media a = requireMedia(id);
        apply(a, req);
        mediaMapper.updateById(a);
        embeddingTaskService.enqueue(EntityType.MEDIA, id);
        return a;
    }

    @Transactional
    public Media rename(Long id, String title) {
        Media a = requireMedia(id);
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title 不能为空");
        }
        a.setTitle(title.trim());
        mediaMapper.updateById(a);
        embeddingTaskService.enqueue(EntityType.MEDIA, id);
        return a;
    }

    /** 手工确认：自动识别为低置信的番剧经审核后置 confirmed=1。 */
    @Transactional
    public Media confirm(Long id) {
        Media a = requireMedia(id);
        a.setConfirmed(1);
        mediaMapper.updateById(a);
        return a;
    }

    /** 合并：把 fromId 的集全部移到 intoId，标签合并去重，然后删除 fromId 档案。 */
    @Transactional
    public void merge(Long fromId, Long intoId) {
        Media from = requireMedia(fromId);
        requireMedia(intoId);
        for (Episode ep : episodeMapper.listByMedia(fromId)) {
            ep.setMediaId(intoId);
            episodeMapper.updateById(ep);
        }
        for (Tag t : mediaTagMapper.selectTags(fromId)) {
            mediaTagMapper.insertIgnore(intoId, t.getId());
        }
        mediaTagMapper.deleteByMedia(fromId);
        mediaCollectionMapper.deleteByMedia(fromId);
        embeddingTaskService.deleteFor(EntityType.MEDIA, from.getId());
        mediaMapper.deleteById(from.getId());
        // 合并后目标番剧的文本变化，重嵌入
        embeddingTaskService.enqueue(EntityType.MEDIA, intoId);
        for (Episode ep : episodeMapper.listByMedia(intoId)) {
            embeddingTaskService.enqueue(EntityType.EPISODE, ep.getId());
        }
    }

    /** 删除番剧：级联删除其下所有集、片段及其标签/向量/任务，并清理全部封面文件。 */
    @Transactional
    public void delete(Long id) {
        Media a = requireMedia(id);
        for (Episode ep : episodeMapper.listByMedia(id)) {
            coverService.deleteCover(ep.getCoverPath());
            for (Clip c : clipMapper.listByEpisode(ep.getId())) {
                coverService.deleteCover(c.getCoverPath());
                coverService.deleteCover(c.getDetailCoverPath());
                embeddingTaskService.deleteFor(EntityType.CLIP, c.getId());
                clipTagMapper.deleteByClip(c.getId());
            }
            clipMapper.deleteByEpisode(ep.getId());
            episodeTagMapper.deleteByEpisode(ep.getId());
            embeddingTaskService.deleteFor(EntityType.EPISODE, ep.getId());
            episodeMapper.deleteById(ep.getId());
        }
        coverService.deleteCover(a.getCoverPath());
        mediaTagMapper.deleteByMedia(id);
        mediaCollectionMapper.deleteByMedia(id);
        embeddingTaskService.deleteFor(EntityType.MEDIA, a.getId());
        mediaMapper.deleteById(a.getId());
    }

    /** 批量删除媒体（级联清理同上）。单个失败中断回滚。 */
    @Transactional
    public void deleteBatch(List<Long> ids) {
        for (Long id : ids) {
            delete(id);
        }
    }

    /** 某番剧的集列表（带片段数/集级标签）；封面解析：显式集封面为空时落到代表性片段帧。 */
    public List<EpisodeDetail> episodes(Long mediaId) {
        requireMedia(mediaId);
        return episodeMapper.listSummariesByMedia(mediaId).stream()
                .map(s -> EpisodeDetail.from(s, episodeTagMapper.selectTags(s.id()), resolveEpisodeCover(s)))
                .toList();
    }

    private String resolveEpisodeCover(EpisodeSummary s) {
        if (s.coverPath() != null) {
            return s.coverPath();
        }
        return clipMapper.selectRepresentativeCoverByEpisode(s.id());
    }

    public void addTag(Long mediaId, String tagName) {
        requireMedia(mediaId);
        Tag tag = ensureTag(tagName);
        if (tag != null) {
            mediaTagMapper.insertIgnore(mediaId, tag.getId());
            embeddingTaskService.enqueue(EntityType.MEDIA, mediaId);
        }
    }

    public void removeTag(Long mediaId, Long tagId) {
        requireMedia(mediaId);
        mediaTagMapper.deleteLink(mediaId, tagId);
        embeddingTaskService.enqueue(EntityType.MEDIA, mediaId);
    }

    private Media requireMedia(Long id) {
        Media a = mediaMapper.selectById(id);
        if (a == null) {
            throw new NoSuchElementException("media not found: " + id);
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

    private void apply(Media a, MediaRequest req) {
        a.setTitle(req.title());
        a.setYear(req.year());
        a.setOriginalTitle(req.originalTitle() == null ? null : req.originalTitle().trim());
        // 格式必须存在于字典；缺省/非法回退 VIDEO
        String format = req.mediaFormat() == null ? "" : req.mediaFormat().trim().toUpperCase();
        MediaFormat mf = format.isEmpty() ? null
                : mediaFormatMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<MediaFormat>()
                        .eq("code", format));
        a.setMediaFormat(mf != null ? mf.getCode() : "VIDEO");
        applySubcategory(a, req, mf != null ? mf.getId() : mediaFormatIdOf("VIDEO"));
        a.setStatus(STATUSES.contains(req.status()) ? req.status() : "WANT");
        a.setRating(req.rating());
        a.setNote(req.note() == null ? "" : req.note().trim());
    }

    /** 子分类：优先按节点 id 引用（须属于所选格式）；旧客户端只传名字时按名字在格式树中回退解析。 */
    private void applySubcategory(Media a, MediaRequest req, long formatId) {
        a.setSubcategory(null);
        a.setSubcategoryId(null);
        Long id = req.subcategoryId();
        if (id != null && id > 0) {
            MediaSubcategory node = mediaSubcategoryMapper.selectById(id);
            if (node != null && node.getFormatId() != null && node.getFormatId() == formatId) {
                a.setSubcategoryId(node.getId());
                a.setSubcategory(node.getName()); // 展示快照
            }
            return;
        }
        String sub = req.subcategory() == null ? null : req.subcategory().trim();
        if (sub != null && !sub.isEmpty()) {
            MediaSubcategory node = mediaSubcategoryMapper.selectOne(
                    new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<MediaSubcategory>()
                            .eq("format_id", formatId).eq("name", sub).last("LIMIT 1"));
            if (node != null) {
                a.setSubcategoryId(node.getId());
                a.setSubcategory(node.getName());
            }
        }
    }

    private long mediaFormatIdOf(String code) {
        MediaFormat mf = mediaFormatMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<MediaFormat>().eq("code", code));
        return mf != null ? mf.getId() : -1L;
    }
}
