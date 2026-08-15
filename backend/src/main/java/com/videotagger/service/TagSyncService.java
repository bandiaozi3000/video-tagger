package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Media;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaTagMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.Set;

/** 标签三级同步：片段 → 集 → 媒体，单向向上并集（INSERT OR IGNORE 幂等）。删除不做降级级联，由用户按需在详情页手动清理。 */
@Service
public class TagSyncService {

    private final ClipMapper clipMapper;
    private final EpisodeMapper episodeMapper;
    private final MediaMapper mediaMapper;
    private final ClipTagMapper clipTagMapper;
    private final EpisodeTagMapper episodeTagMapper;
    private final MediaTagMapper mediaTagMapper;
    private final EmbeddingTaskService embeddingTaskService;

    public TagSyncService(ClipMapper clipMapper, EpisodeMapper episodeMapper, MediaMapper mediaMapper,
                          ClipTagMapper clipTagMapper, EpisodeTagMapper episodeTagMapper,
                          MediaTagMapper mediaTagMapper, EmbeddingTaskService embeddingTaskService) {
        this.clipMapper = clipMapper;
        this.episodeMapper = episodeMapper;
        this.mediaMapper = mediaMapper;
        this.clipTagMapper = clipTagMapper;
        this.episodeTagMapper = episodeTagMapper;
        this.mediaTagMapper = mediaTagMapper;
        this.embeddingTaskService = embeddingTaskService;
    }

    /** 片段打标后：该片段标签并集同步到所属集，再由集上溯媒体。 */
    @Transactional
    public void syncFromClip(long clipId) {
        Clip clip = clipMapper.selectById(clipId);
        if (clip == null || clip.getEpisodeId() == null) {
            return;
        }
        for (Tag t : clipTagMapper.selectTags(clipId)) {
            episodeTagMapper.insertIgnore(clip.getEpisodeId(), t.getId());
        }
        syncFromEpisode(clip.getEpisodeId());
    }

    /** 集打标后：集标签并集同步到所属媒体，并触发媒体重嵌。 */
    @Transactional
    public void syncFromEpisode(long episodeId) {
        Episode ep = episodeMapper.selectById(episodeId);
        if (ep == null) {
            return;
        }
        for (Tag t : episodeTagMapper.selectTags(episodeId)) {
            mediaTagMapper.insertIgnore(ep.getMediaId(), t.getId());
        }
        embeddingTaskService.enqueue(EntityType.MEDIA, ep.getMediaId());
    }

    /** 历史数据全量同步（幂等）：episode_tag = 该集下片段标签并集；media_tag = 该媒体下全部片段+集标签并集。返回新增媒体标签条数。 */
    @Transactional
    public int syncAll() {
        int synced = 0;
        for (Media m : mediaMapper.selectList(null)) {
            Set<Long> mediaTagIds = new LinkedHashSet<>();
            for (Episode ep : episodeMapper.listByMedia(m.getId())) {
                for (Clip c : clipMapper.listByEpisode(ep.getId())) {
                    for (Tag t : clipTagMapper.selectTags(c.getId())) {
                        episodeTagMapper.insertIgnore(ep.getId(), t.getId());
                        mediaTagIds.add(t.getId());
                    }
                }
                for (Tag t : episodeTagMapper.selectTags(ep.getId())) {
                    mediaTagIds.add(t.getId());
                }
            }
            if (mediaTagIds.isEmpty()) {
                continue;
            }
            for (Long tid : mediaTagIds) {
                synced += mediaTagMapper.insertIgnore(m.getId(), tid);
            }
            embeddingTaskService.enqueue(EntityType.MEDIA, m.getId());
        }
        return synced;
    }
}
