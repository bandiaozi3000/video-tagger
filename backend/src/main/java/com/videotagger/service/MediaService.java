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
import com.videotagger.util.MediaTitleNormalizer;
import com.videotagger.util.TitleParser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
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
    private final TitleMappingService titleMappingService;
    private final ClipExportService clipExportService;
    private final HighlightProjectService highlightProjectService;

    public MediaService(MediaMapper mediaMapper, EpisodeMapper episodeMapper,
                        MediaTagMapper mediaTagMapper, EpisodeTagMapper episodeTagMapper,
                        ClipTagMapper clipTagMapper, ClipMapper clipMapper,
                        TagMapper tagMapper, MediaCollectionMapper mediaCollectionMapper,
                        MediaFormatMapper mediaFormatMapper, MediaSubcategoryMapper mediaSubcategoryMapper,
                        EmbeddingTaskService embeddingTaskService, CoverService coverService,
                        TitleMappingService titleMappingService) {
        this(mediaMapper, episodeMapper, mediaTagMapper, episodeTagMapper, clipTagMapper, clipMapper,
                tagMapper, mediaCollectionMapper, mediaFormatMapper, mediaSubcategoryMapper,
                embeddingTaskService, coverService, titleMappingService, null, null);
    }

    @Autowired
    public MediaService(MediaMapper mediaMapper, EpisodeMapper episodeMapper,
                        MediaTagMapper mediaTagMapper, EpisodeTagMapper episodeTagMapper,
                        ClipTagMapper clipTagMapper, ClipMapper clipMapper,
                        TagMapper tagMapper, MediaCollectionMapper mediaCollectionMapper,
                        MediaFormatMapper mediaFormatMapper, MediaSubcategoryMapper mediaSubcategoryMapper,
                        EmbeddingTaskService embeddingTaskService, CoverService coverService,
                        TitleMappingService titleMappingService, ClipExportService clipExportService,
                        HighlightProjectService highlightProjectService) {
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
        this.titleMappingService = titleMappingService;
        this.clipExportService = clipExportService;
        this.highlightProjectService = highlightProjectService;
    }

    /** 媒体卡片墙：支持状态/格式/子分类（子树收敛）/待确认/收藏夹/年份/来源/媒体标签/q 标题模糊筛选；ids 精确圈选（仅显示已勾选用）；offset 分页。 */
    public List<MediaSummary> list(int limit, int offset, String status, String format, Long subcategoryId,
                                   Integer confirmed, Long collectionId, String sort, String order, Integer year,
                                   String source, Long tagId, String q, List<Long> ids) {
        return mediaMapper.listFiltered(status, format, subcategoryId, confirmed, collectionId, sort, order, year,
                source, tagId, q, ids,
                Math.min(Math.max(limit, 1), 200), Math.max(offset, 0));
    }

    /** 最近观看：打过标记即算，按最新标记时间倒序；支持 status/format/子分类/confirmed/collectionId/year/source/q 筛选；offset 分页。 */
    public List<MediaSummary> recent(int limit, int offset, String status, String format, Long subcategoryId,
                                     Integer confirmed, Long collectionId, Integer year, String source, String q) {
        return mediaMapper.listByLatest(Math.min(Math.max(limit, 1), 200), Math.max(offset, 0),
                status, format, subcategoryId, confirmed, collectionId, year, source, q);
    }

    /** 带筛选的媒体总数：全部媒体/收藏夹分支走 countFiltered，最近观看分支（latest=true）走 countLatest。 */
    public long count(String status, String format, Long subcategoryId, Integer confirmed, Long collectionId,
                      Integer year, String source, Long tagId, boolean latest, String q) {
        if (latest) {
            return mediaMapper.countLatest(status, format, subcategoryId, confirmed, collectionId, year, source, q);
        }
        return mediaMapper.countFiltered(status, format, subcategoryId, confirmed, collectionId, year, source, tagId, q);
    }

    /** 库中已有的全部首播年份（降序）。 */
    public List<Integer> years() {
        return mediaMapper.listDistinctYears();
    }

    /** 补下缺失封面已停用：外部封面只从 external_work.cover_url 远程读取，用户封面仍走 cover_path。 */
    public int retryCovers() {
        return 0;
    }

    public MediaDetail get(Long id) {
        Media a = requireMedia(id);
        long clipCount = clipMapper.countByMedia(id);
        long episodeCount = episodeMapper.countByMedia(id);
        String fallbackCoverPath = a.getCoverPath() == null
                ? clipMapper.selectRepresentativeCoverByMedia(id) : null;
        String source = mediaMapper.selectProviderByMedia(id);
        String externalCoverUrl = mediaMapper.selectExternalCoverByMedia(id);
        return new MediaDetail(a.getId(), a.getTitle(), a.getYear(), null, a.getAliases(), a.getMediaFormat(),
                a.getSubcategory(), a.getSubcategoryId(), a.getNote(), a.getStatus(), a.getRating(), a.getCoverPath(),
                a.getConfirmed(), source, a.getCreatedAt(), clipCount, episodeCount, mediaTagMapper.selectTags(id),
                mediaCollectionMapper.selectCollectionIdsByMedia(id), fallbackCoverPath, externalCoverUrl);
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

    /** 打标签候选匹配：归一化 + 相似度（识别「爱你宝贝」≈「我爱你BABY」），相似度≥0.6 返回（降序，limit 个）。
     *  扩展候选区提示用——用户勾选才归入（不自动归入）。 */
    public List<MediaMatchCandidate> matchCandidates(String title, int limit) {
        if (MediaTitleNormalizer.normalize(title).isEmpty()) {
            return List.of();
        }
        List<Media> all = mediaMapper.selectList(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<Media>()
                .select("id", "title", "year", "subcategory", "confirmed")
                .isNull("deleted_at"));
        List<MediaMatchCandidate> out = new ArrayList<>();
        for (Media m : all) {
            double score = MediaTitleNormalizer.similarity(title, m.getTitle());
            if (score >= 0.6) {
                out.add(new MediaMatchCandidate(m.getId(), m.getTitle(), m.getYear(), m.getSubcategory(),
                        clipMapper.countByMedia(m.getId()), score));
            }
        }
        out.sort((a, b) -> Double.compare(b.score(), a.score()));
        return out.size() > limit ? out.subList(0, limit) : out;
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
        /* 合并即记住别名：被合并媒体的识别名 → 目标媒体；下次保存同标题直接归位，不再重复合并 */
        String fromName = from.getTitle();
        if (fromName != null && !fromName.isBlank()) {
            titleMappingService.save(TitleParser.parse(fromName).mediaTitle(), intoId);
        }
        mediaMapper.deleteById(from.getId());
        // 合并后目标番剧的文本变化，重嵌入
        embeddingTaskService.enqueue(EntityType.MEDIA, intoId);
        for (Episode ep : episodeMapper.listByMedia(intoId)) {
            embeddingTaskService.enqueue(EntityType.EPISODE, ep.getId());
        }
    }

    /** 移入回收站（软删除）：只置 deleted_at，集/片段/标签/封面/向量保留（撤回原样恢复）。 */
    @Transactional
    public void trash(Long id) {
        Media a = requireMedia(id);
        a.setDeletedAt(System.currentTimeMillis());
        mediaMapper.updateById(a);
    }

    /** 批量移入回收站。 */
    @Transactional
    public void trashBatch(List<Long> ids) {
        for (Long id : ids) {
            trash(id);
        }
    }

    /** 撤回（恢复）：deleted_at 置空，媒体连同保留的集/片段/标签原样恢复。 */
    @Transactional
    public void restore(Long id) {
        Media a = requireMedia(id);
        a.setDeletedAt(null);
        mediaMapper.updateById(a);
    }

    /** 彻底删除媒体：级联删除其下所有集、片段及其标签/向量/任务，并清理全部封面文件。 */
    @Transactional
    public void purge(Long id) {
        Media a = requireMedia(id);
        for (Episode ep : episodeMapper.listByMedia(id)) {
            coverService.deleteCover(ep.getCoverPath());
            for (Clip c : clipMapper.listByEpisode(ep.getId())) {
                coverService.deleteCover(c.getCoverPath());
                coverService.deleteCover(c.getDetailCoverPath());
                if (clipExportService != null) clipExportService.deleteArtifacts(c.getId());
                if (highlightProjectService != null) {
                    highlightProjectService.markClipUnavailable(c.getId(), "原始片段已删除，请移除或上传替代素材");
                }
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

    /** 批量彻底删除（级联清理同上）。单个失败中断回滚。 */
    @Transactional
    public void purgeBatch(List<Long> ids) {
        for (Long id : ids) {
            purge(id);
        }
    }

    /** 回收站列表：已删媒体（deleted_at 非空），q 按标题模糊过滤，按删除时间倒序。 */
    public List<Media> listTrash(String q, int limit, int offset) {
        return mediaMapper.listTrash(q, Math.min(Math.max(limit, 1), 200), Math.max(offset, 0));
    }

    /** 回收站数量（可带标题过滤）。 */
    public long countTrash(String q) {
        return mediaMapper.countTrash(q);
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
        // originalTitle 已迁移到 external_work，Media 只保留本地标题/别名。
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
