package com.videotagger.service;

import com.videotagger.entity.Episode;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.TagMapper;
import com.videotagger.util.VideoFingerprint;
import org.springframework.stereotype.Service;

import java.util.NoSuchElementException;

/** 集级标签管理（Web UI 打标入口，Phase 1 形态；「看完自动弹」为待办）。 */
@Service
public class EpisodeService {

    private final EpisodeMapper episodeMapper;
    private final EpisodeTagMapper episodeTagMapper;
    private final TagMapper tagMapper;
    private final EmbeddingTaskService embeddingTaskService;

    public EpisodeService(EpisodeMapper episodeMapper, EpisodeTagMapper episodeTagMapper,
                          TagMapper tagMapper, EmbeddingTaskService embeddingTaskService) {
        this.episodeMapper = episodeMapper;
        this.episodeTagMapper = episodeTagMapper;
        this.tagMapper = tagMapper;
        this.embeddingTaskService = embeddingTaskService;
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

    private Episode requireEpisode(Long id) {
        Episode ep = episodeMapper.selectById(id);
        if (ep == null) {
            throw new NoSuchElementException("episode not found: " + id);
        }
        return ep;
    }
}
