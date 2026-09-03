package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.TagMapper;
import com.videotagger.util.VideoFingerprint;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

/** 集级标签管理（Web UI 打标入口，Phase 1 形态；「看完自动弹」为待办）。 */
@Service
public class EpisodeService {

    private final EpisodeMapper episodeMapper;
    private final EpisodeTagMapper episodeTagMapper;
    private final TagMapper tagMapper;
    private final EmbeddingTaskService embeddingTaskService;
    private final CoverService coverService;
    private final ClipMapper clipMapper;
    private final ClipTagMapper clipTagMapper;
    private final TagSyncService tagSyncService;
    private final ClipExportService clipExportService;
    private final HighlightProjectService highlightProjectService;

    public EpisodeService(EpisodeMapper episodeMapper, EpisodeTagMapper episodeTagMapper,
                          TagMapper tagMapper, EmbeddingTaskService embeddingTaskService,
                          CoverService coverService, ClipMapper clipMapper, ClipTagMapper clipTagMapper,
                          TagSyncService tagSyncService) {
        this(episodeMapper, episodeTagMapper, tagMapper, embeddingTaskService, coverService, clipMapper,
                clipTagMapper, tagSyncService, null, null);
    }

    @Autowired
    public EpisodeService(EpisodeMapper episodeMapper, EpisodeTagMapper episodeTagMapper,
                          TagMapper tagMapper, EmbeddingTaskService embeddingTaskService,
                          CoverService coverService, ClipMapper clipMapper, ClipTagMapper clipTagMapper,
                          TagSyncService tagSyncService, ClipExportService clipExportService,
                          HighlightProjectService highlightProjectService) {
        this.episodeMapper = episodeMapper;
        this.episodeTagMapper = episodeTagMapper;
        this.tagMapper = tagMapper;
        this.embeddingTaskService = embeddingTaskService;
        this.coverService = coverService;
        this.clipMapper = clipMapper;
        this.clipTagMapper = clipTagMapper;
        this.tagSyncService = tagSyncService;
        this.clipExportService = clipExportService;
        this.highlightProjectService = highlightProjectService;
    }

    /** 更新集信息：备注/集号。字段传 null 表示不改；note 传空串表示清空；变更后入队重嵌。 */
    @Transactional
    public void update(Long id, String note, Integer episodeNo) {
        Episode ep = requireEpisode(id);
        boolean changed = false;
        if (note != null) {
            String trimmed = note.trim();
            if (!trimmed.equals(ep.getNote() == null ? "" : ep.getNote())) {
                ep.setNote(trimmed);
                changed = true;
            }
        }
        if (episodeNo != null && !episodeNo.equals(ep.getEpisodeNo())) {
            ep.setEpisodeNo(episodeNo);
            changed = true;
        }
        if (changed) {
            episodeMapper.updateById(ep);
            embeddingTaskService.enqueue(EntityType.EPISODE, id);
        }
    }

    public void addTag(Long episodeId, String tagName) {
        requireEpisode(episodeId);
        String trimmed = tagName == null ? "" : tagName.trim();
        if (trimmed.isEmpty()) {
            return;
        }
        tagMapper.insertIgnore(trimmed, System.currentTimeMillis());
        Tag tag = tagMapper.selectByName(trimmed);
        if (tag != null) {
            episodeTagMapper.insertIgnore(episodeId, tag.getId());
            embeddingTaskService.enqueue(EntityType.EPISODE, episodeId);
            // 集标签向上并集同步到所属媒体（媒体标签过滤可用）
            tagSyncService.syncFromEpisode(episodeId);
        }
    }

    public void removeTag(Long episodeId, Long tagId) {
        requireEpisode(episodeId);
        episodeTagMapper.deleteLink(episodeId, tagId);
        embeddingTaskService.enqueue(EntityType.EPISODE, episodeId);
    }

    /** 扩展「看完自动弹」用：按播放 URL 定位集并加标签（video_fp 归一）。 */
    public void addTagByUrl(String url, String tagName) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("url 不能为空");
        }
        String fp = VideoFingerprint.fingerprint(url);
        Episode ep = episodeMapper.selectByFp(fp);
        if (ep == null) {
            throw new NoSuchElementException("episode not found for url");
        }
        addTag(ep.getId(), tagName);
    }

    /** 手动上传集封面（Web UI 兜底）。 */
    public void setCover(Long episodeId, byte[] bytes) {
        requireEpisode(episodeId);
        String path = coverService.saveEpisodeCover(episodeId, bytes);
        updateCover(episodeId, path);
    }

    /** 从该集某片段截帧自选高能画面：复制片段封面字节为集封面。 */
    public void setCoverFromClip(Long episodeId, Long clipId) {
        requireEpisode(episodeId);
        String path = coverService.saveEpisodeCoverFromClip(episodeId, clipId);
        updateCover(episodeId, path);
    }

    private void updateCover(Long episodeId, String path) {
        Episode ep = episodeMapper.selectById(episodeId);
        ep.setCoverPath(path);
        episodeMapper.updateById(ep);
    }

    /** 集详情页：构建 EpisodeDetail（解析封面 + 集级标签 + 片段数 + 最近标记）。 */
    public EpisodeDetail detail(Long id) {
        Episode ep = requireEpisode(id);
        List<Clip> clips = clipMapper.listByEpisode(id);
        long clipCount = clips.size();
        long latestAt = clips.stream().mapToLong(Clip::getCreatedAt).max().orElse(0L);
        String cover = ep.getCoverPath() != null ? ep.getCoverPath()
                : clipMapper.selectRepresentativeCoverByEpisode(id);
        return new EpisodeDetail(id, ep.getMediaId(), ep.getEpisodeNo(),
                ep.getTitle(), ep.getNote(), ep.getUrl(), ep.getVideoFp(), clipCount, latestAt,
                episodeTagMapper.selectTags(id), cover, ep.getWatchedAt());
    }

    public List<Clip> clips(Long id) {
        requireEpisode(id);
        return clipMapper.listByEpisode(id);
    }

    /** 删除集：级联删除其下片段（含封面/标签/向量）与集标签/集封面/集向量。 */
    @Transactional
    public void delete(Long id) {
        Episode ep = requireEpisode(id);
        for (Clip c : clipMapper.listByEpisode(id)) {
            coverService.deleteCover(c.getCoverPath());
            coverService.deleteCover(c.getDetailCoverPath());
            if (clipExportService != null) clipExportService.deleteArtifacts(c.getId());
            if (highlightProjectService != null) {
                highlightProjectService.markClipUnavailable(c.getId(), "原始片段已删除，请移除或上传替代素材");
            }
            embeddingTaskService.deleteFor(EntityType.CLIP, c.getId());
            clipTagMapper.deleteByClip(c.getId());
        }
        clipMapper.deleteByEpisode(id);
        episodeTagMapper.deleteByEpisode(id);
        coverService.deleteCover(ep.getCoverPath());
        embeddingTaskService.deleteFor(EntityType.EPISODE, id);
        episodeMapper.deleteById(id);
    }

    private Episode requireEpisode(Long id) {
        Episode ep = episodeMapper.selectById(id);
        if (ep == null) {
            throw new NoSuchElementException("episode not found: " + id);
        }
        return ep;
    }
}
