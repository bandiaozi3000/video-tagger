package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.TestTagSeed;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Media;
import com.videotagger.mapper.EmbeddingTaskMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.NoSuchElementException;

import static org.junit.jupiter.api.Assertions.*;

class ClipServiceIT extends AbstractMySqlIT {

    @Autowired
    ClipService clipService;

    @Autowired
    EmbeddingTaskMapper taskMapper;

    @Autowired
    MediaMapper mediaMapper;

    @Autowired
    TitleMappingService titleMappingService;

    @Autowired
    TagMapper tagMapper;

    @Autowired
    com.videotagger.mapper.EpisodeMapper episodeMapper;

    /** v0.31 标签受控：测试里先建词条，再传 id。 */
    private List<Long> tags(String... names) {
        return TestTagSeed.ensure(tagMapper, names);
    }

    private Media insertMedia(String title) {
        Media m = new Media();
        m.setTitle(title);
        m.setMediaFormat("VIDEO");
        m.setStatus("WANT");
        m.setConfirmed(1);
        m.setCreatedAt(System.currentTimeMillis());
        mediaMapper.insert(m);
        return m;
    }

    @Test
    void saveCreatesClipAndPendingTask() {
        SaveClipResult result = clipService.save(new SaveClipRequest(
                "某动画 第3集", "https://www.bilibili.com/video/BV1", 754.5, tags("高燃战斗"), "主角觉醒"));

        assertFalse(result.deduped());
        assertNotNull(result.id());
        assertNull(taskMapper.selectById(result.id()));
    }

    @Test
    void saveSameUrlWithin3SecondsDeduplicates() {
        SaveClipRequest req = new SaveClipRequest(
                "某动画 第3集", "https://www.bilibili.com/video/BV2", 100.0, tags("战斗"), "");

        SaveClipResult first = clipService.save(req);
        SaveClipResult second = clipService.save(req);

        assertTrue(second.deduped());
        assertEquals(first.id(), second.id());
    }

    @Test
    void saveSameUrlWithDifferentTagIsNewRecord() {
        SaveClipRequest first = new SaveClipRequest(
                "某动画", "https://www.bilibili.com/video/BV3", 100.0, tags("战斗"), "");
        SaveClipRequest second = new SaveClipRequest(
                "某动画", "https://www.bilibili.com/video/BV3", 100.0, tags("泪目"), "");

        SaveClipResult r1 = clipService.save(first);
        SaveClipResult r2 = clipService.save(second);

        assertFalse(r2.deduped());
        assertNotEquals(r1.id(), r2.id());
    }

    @Test
    void saveClaimsExistingBangumiEpisodeWithoutUrl() {
        Media m = insertMedia("某同步番剧");
        com.videotagger.entity.Episode ep = new com.videotagger.entity.Episode();
        ep.setMediaId(m.getId());
        ep.setEpisodeNo(5);
        ep.setTitle("顾问！");
        ep.setCreatedAt(System.currentTimeMillis());
        episodeMapper.insert(ep);

        SaveClipResult r = clipService.save(new SaveClipRequest(
                "某同步番剧 第5集", "https://claim.test/ep5", 30.0, tags("高燃"), "",
                null, null, null, null, m.getId(), null));

        // 认领已有集（而不是新建重复集），并回填 url/指纹
        assertEquals(5, r.episodeNo());
        assertEquals(ep.getId(), clipService.get(r.id()).getEpisodeId());
        com.videotagger.entity.Episode claimed = episodeMapper.selectById(ep.getId());
        assertNotNull(claimed.getVideoFp());
        assertEquals("https://claim.test/ep5", claimed.getUrl());
        assertEquals(1, episodeMapper.listByMedia(m.getId()).size());
    }

    @Test
    void updateChangesTagAndResetsEmbeddingTask() {
        SaveClipResult saved = clipService.save(new SaveClipRequest(
                "某动画", "https://b.com/1", 10.0, tags("高燃"), "旧备注"));

        Clip updated = clipService.update(saved.id(),
                new SaveClipRequest("某动画", "https://b.com/1", 10.0, tags("名场面"), "新备注"));

        assertEquals(List.of("名场面"), updated.getTagNames());
        assertNull(taskMapper.selectById(saved.id()));
    }

    @Test
    void updateReplacesTags() {
        SaveClipResult saved = clipService.save(new SaveClipRequest(
                "某动画", "https://b.com/2", 20.0, tags("高燃"), ""));

        Clip updated = clipService.update(saved.id(),
                new SaveClipRequest("某动画", "https://b.com/2", 20.0, tags("名场面"), ""));

        // v0.31：全量替换（不再有 appendTag 语义）
        assertEquals(List.of("名场面"), updated.getTagNames());
    }

    @Test
    void findNearbyReturnsClipsWithinWindow() {
        clipService.save(new SaveClipRequest("某动画", "https://n.com/1", 100.0, tags("高燃"), ""));
        clipService.save(new SaveClipRequest("某动画", "https://n.com/1", 105.0, tags("名场面"), ""));
        clipService.save(new SaveClipRequest("某动画", "https://n.com/1", 200.0, tags("泪目"), ""));

        List<Clip> nearby = clipService.findNearby("https://n.com/1", 102.0, 10.0);

        assertEquals(2, nearby.size());
        assertEquals(List.of("高燃"), nearby.get(0).getTagNames());
    }

    @Test
    void getReturnsFullClipForDetailPage() {
        SaveClipResult saved = clipService.save(new SaveClipRequest(
                "某动画 第3集", "https://get.com/1", 42.0, tags("高燃"), "名场面备注"));

        Clip clip = clipService.get(saved.id());
        assertEquals(42.0, clip.getTimestampSec());
        assertEquals(List.of("高燃"), clip.getTagNames());
        assertEquals("名场面备注", clip.getNote());
        assertNotNull(clip.getVideoFp());
        assertNotNull(clip.getEpisodeId());
        assertThrows(NoSuchElementException.class, () -> clipService.get(999999L));
    }

    @Test
    void deleteRemovesClipAndTask() {
        SaveClipResult saved = clipService.save(new SaveClipRequest(
                "某动画", "https://b.com/3", 30.0, tags("高燃"), ""));

        assertTrue(clipService.delete(saved.id()));
        assertFalse(clipService.delete(saved.id())); // 二次删除返回 false
        // 按 entity 查任务是否随片段删除清理（selectById 依赖 clip/task 自增对齐，多测试共享容器会错位）
        assertNull(taskMapper.selectByEntity("CLIP", saved.id()));
    }

    @Test
    void titleMappingAutoAssignsOnRepeatedTitle() {
        Media m = insertMedia("我爱你BABY");

        // 首次：候选确认归入（mediaId 非空）→ 存映射
        SaveClipResult first = clipService.save(new SaveClipRequest(
                "爱你宝贝 第1集", "https://map.test/1", 10.0, tags("高燃"), "",
                null, null, null, null, m.getId(), null));
        assertEquals(m.getId(), first.mediaId());
        assertEquals(m.getId(), titleMappingService.getByTitle("爱你宝贝"));

        // 再次：同标题不带 mediaId → 标题映射自动归位，不再新建
        SaveClipResult second = clipService.save(new SaveClipRequest(
                "爱你宝贝 第2集", "https://map.test/2", 20.0, tags("高燃"), ""));
        assertEquals(m.getId(), second.mediaId());
        assertEquals(m.getId(), titleMappingService.getByTitle("爱你宝贝"));
    }

    @Test
    void forceNewMediaBreaksMappingAndCreatesNew() {
        Media m = insertMedia("我爱你BABY");

        // 建立映射（首次候选确认归入）
        clipService.save(new SaveClipRequest(
                "爱你宝贝 第1集", "https://map.test/10", 10.0, tags("高燃"), "",
                null, null, null, null, m.getId(), null));
        assertEquals(m.getId(), titleMappingService.getByTitle("爱你宝贝"));

        // forceNewMedia：断开映射 + 跳过自动匹配 → 新建媒体（解析名「爱你宝贝」与库中「我爱你BABY」前缀不匹配）
        SaveClipResult result = clipService.save(new SaveClipRequest(
                "爱你宝贝 第2集", "https://map.test/11", 20.0, tags("高燃"), "",
                null, null, null, null, null, true));
        assertNotEquals(m.getId(), result.mediaId());
        assertEquals("爱你宝贝", result.mediaTitle());
        assertNull(titleMappingService.getByTitle("爱你宝贝"), "映射应被解除");
    }

    @Test
    void titleMappingResolveAndDeleteForRawTitle() {
        Media m = insertMedia("我爱你BABY");

        titleMappingService.saveForRawTitle("爱你宝贝 第1集", m.getId());
        TitleMappingService.TitleMappingView view = titleMappingService.resolve("爱你宝贝 第2集");
        assertEquals("爱你宝贝", view.parsedTitle());
        assertEquals(m.getId(), view.mediaId());
        assertEquals("我爱你BABY", view.mediaTitle());

        titleMappingService.deleteForRawTitle("爱你宝贝 第9集");
        assertNull(titleMappingService.resolve("爱你宝贝 第2集").mediaId());
    }
}
