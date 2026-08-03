package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Anime;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.AnimeMapper;
import com.videotagger.mapper.AnimeTagMapper;
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
class AnimeServiceIT extends AbstractMySqlIT {

    @Autowired
    AnimeService animeService;
    @Autowired
    ClipService clipService;
    @Autowired
    AnimeMapper animeMapper;
    @Autowired
    EpisodeMapper episodeMapper;
    @Autowired
    AnimeTagMapper animeTagMapper;
    @Autowired
    ClipTagMapper clipTagMapper;
    @Autowired
    ClipMapper clipMapper;

    @Test
    void saveClipAutoCreatesAnimeAndEpisode() {
        SaveClipResult r = clipService.save(new SaveClipRequest(
                "葬送的芙莉莲 第3集", "https://www.bilibili.com/video/BV-ane1", 100.0, "高燃", ""));

        assertEquals("葬送的芙莉莲", r.animeTitle());
        assertEquals(3, r.episodeNo());

        Anime anime = animeMapper.selectByTitlePrefix("葬送的芙莉莲");
        assertNotNull(anime);
        assertEquals(0, anime.getConfirmed()); // 自动识别置待确认

        String fp = VideoFingerprint.fingerprint("https://www.bilibili.com/video/BV-ane1");
        Episode ep = episodeMapper.selectByFp(fp);
        assertNotNull(ep);
        assertEquals(anime.getId(), ep.getAnimeId());
        assertEquals(3, ep.getEpisodeNo());

        // 片段标签进词库关联
        List<Tag> tags = clipTagMapper.selectTags(r.id());
        assertEquals(1, tags.size());
        assertEquals("高燃", tags.get(0).getName());
    }

    @Test
    void sameEpisodeReusesAnimeAndEpisode() {
        clipService.save(new SaveClipRequest("某番剧 第2集", "https://x.com/ep2", 50.0, "高燃", ""));
        clipService.save(new SaveClipRequest("某番剧 第2集", "https://x.com/ep2", 70.0, "泪目", ""));

        Anime anime = animeMapper.selectByTitlePrefix("某番剧");
        assertNotNull(anime);
        String fp = VideoFingerprint.fingerprint("https://x.com/ep2");
        Episode ep = episodeMapper.selectByFp(fp);
        assertNotNull(ep);
        // 两个片段归同一集，不重复建番剧/集
        assertEquals(2, clipMapper.listByEpisode(ep.getId()).size());
    }

    @Test
    void createAndGetAnime() {
        Anime created = animeService.create(new AnimeRequest("测试新番", "ANIME", "WATCHING", null));
        assertNotNull(created.getId());
        assertEquals(1, created.getConfirmed()); // 手动创建已确认

        AnimeDetail detail = animeService.get(created.getId());
        assertEquals("测试新番", detail.title());
        assertEquals("WATCHING", detail.status());
    }

    @Test
    void addAndRemoveAnimeTag() {
        Anime a = animeService.create(new AnimeRequest("标签测试", "ANIME", "WANT", null));
        animeService.addTag(a.getId(), "热血");
        assertEquals(1, animeTagMapper.selectTags(a.getId()).size());

        Tag t = animeTagMapper.selectTags(a.getId()).get(0);
        animeService.removeTag(a.getId(), t.getId());
        assertEquals(0, animeTagMapper.selectTags(a.getId()).size());
    }

    @Test
    void mergeMovesEpisodesAndTags() {
        clipService.save(new SaveClipRequest("番剧甲 第1集", "https://m.com/1", 10.0, "高燃", ""));
        Anime a1 = animeMapper.selectByTitlePrefix("番剧甲");
        assertNotNull(a1);
        animeService.addTag(a1.getId(), "热血");

        Anime a2 = animeService.create(new AnimeRequest("番剧乙", "ANIME", "WANT", null));
        animeService.merge(a1.getId(), a2.getId());

        assertEquals(1, episodeMapper.countByAnime(a2.getId()));
        assertEquals(1, animeTagMapper.selectTags(a2.getId()).size());
        assertNull(animeMapper.selectById(a1.getId()));
    }

    @Test
    void deleteCascadesClipsAndEpisodes() {
        clipService.save(new SaveClipRequest("番剧丙 第1集", "https://d.com/1", 10.0, "高燃", ""));
        Anime a = animeMapper.selectByTitlePrefix("番剧丙");
        assertNotNull(a);
        assertTrue(clipMapper.countByAnime(a.getId()) >= 1);

        animeService.delete(a.getId());

        assertNull(animeMapper.selectById(a.getId()));
        assertEquals(0, episodeMapper.countByAnime(a.getId()));
        assertEquals(0, clipMapper.countByAnime(a.getId()));
    }
}
