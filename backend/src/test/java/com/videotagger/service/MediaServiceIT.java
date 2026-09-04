package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Media;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaTagMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.util.VideoFingerprint;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 番剧三层归属：打标保存自动建番剧/集、番剧 CRUD、标签、合并、级联删除。 */
class MediaServiceIT extends AbstractMySqlIT {

    @Autowired
    MediaService mediaService;
    @Autowired
    ClipService clipService;
    @Autowired
    MediaMapper mediaMapper;
    @Autowired
    EpisodeMapper episodeMapper;
    @Autowired
    MediaTagMapper mediaTagMapper;
    @Autowired
    ClipTagMapper clipTagMapper;
    @Autowired
    ClipMapper clipMapper;

    @Test
    void saveClipAutoCreatesMediaAndEpisode() {
        SaveClipResult r = clipService.save(new SaveClipRequest(
                "葬送的芙莉莲 第3集", "https://www.bilibili.com/video/BV-ane1", 100.0, "高燃", ""));

        assertEquals("葬送的芙莉莲", r.mediaTitle());
        assertEquals(3, r.episodeNo());

        Media media = mediaMapper.selectByTitlePrefix("葬送的芙莉莲");
        assertNotNull(media);
        assertEquals(0, media.getConfirmed()); // 自动识别置待确认

        String fp = VideoFingerprint.fingerprint("https://www.bilibili.com/video/BV-ane1");
        Episode ep = episodeMapper.selectByFp(fp);
        assertNotNull(ep);
        assertEquals(media.getId(), ep.getMediaId());
        assertEquals(3, ep.getEpisodeNo());

        // 片段标签进词库关联
        List<Tag> tags = clipTagMapper.selectTags(r.id());
        assertEquals(1, tags.size());
        assertEquals("高燃", tags.get(0).getName());
    }

    @Test
    void sameEpisodeReusesMediaAndEpisode() {
        clipService.save(new SaveClipRequest("某番剧 第2集", "https://x.com/ep2", 50.0, "高燃", ""));
        clipService.save(new SaveClipRequest("某番剧 第2集", "https://x.com/ep2", 70.0, "泪目", ""));

        Media media = mediaMapper.selectByTitlePrefix("某番剧");
        assertNotNull(media);
        String fp = VideoFingerprint.fingerprint("https://x.com/ep2");
        Episode ep = episodeMapper.selectByFp(fp);
        assertNotNull(ep);
        // 两个片段归同一集，不重复建番剧/集
        assertEquals(2, clipMapper.listByEpisode(ep.getId()).size());
    }

    @Test
    void createAndGetMedia() {
        Media created = mediaService.create(new MediaRequest("测试新番", null, null, "VIDEO", null, "番剧", "WATCHING", null, null, null));
        assertNotNull(created.getId());
        assertEquals(1, created.getConfirmed()); // 手动创建已确认

        MediaDetail detail = mediaService.get(created.getId());
        assertEquals("测试新番", detail.title());
        assertEquals("WATCHING", detail.status());
    }

    @Test
    void addAndRemoveMediaTag() {
        Media a = mediaService.create(new MediaRequest("标签测试", null, null, "VIDEO", null, "番剧", "WANT", null, null, null));
        mediaService.addTag(a.getId(), "热血");
        assertEquals(1, mediaTagMapper.selectTags(a.getId()).size());

        Tag t = mediaTagMapper.selectTags(a.getId()).get(0);
        mediaService.removeTag(a.getId(), t.getId());
        assertEquals(0, mediaTagMapper.selectTags(a.getId()).size());
    }

    @Test
    void mergeMovesEpisodesAndTags() {
        clipService.save(new SaveClipRequest("番剧甲 第1集", "https://m.com/1", 10.0, "高燃", ""));
        Media a1 = mediaMapper.selectByTitlePrefix("番剧甲");
        assertNotNull(a1);
        mediaService.addTag(a1.getId(), "热血");

        Media a2 = mediaService.create(new MediaRequest("番剧乙", null, null, "VIDEO", null, "番剧", "WANT", null, null, null));
        mediaService.merge(a1.getId(), a2.getId());

        assertEquals(1, episodeMapper.countByMedia(a2.getId()));
        assertEquals(2, mediaTagMapper.selectTags(a2.getId()).size());
        assertNull(mediaMapper.selectById(a1.getId()));
    }

    @Test
    void deleteCascadesClipsAndEpisodes() {
        clipService.save(new SaveClipRequest("番剧丙 第1集", "https://d.com/1", 10.0, "高燃", ""));
        Media a = mediaMapper.selectByTitlePrefix("番剧丙");
        assertNotNull(a);
        assertTrue(clipMapper.countByMedia(a.getId()) >= 1);

        mediaService.purge(a.getId());

        assertNull(mediaMapper.selectById(a.getId()));
        assertEquals(0, episodeMapper.countByMedia(a.getId()));
        assertEquals(0, clipMapper.countByMedia(a.getId()));
    }
}
