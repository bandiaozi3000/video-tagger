package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Clip;
import com.videotagger.mapper.EmbeddingTaskMapper;
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

    @Test
    void saveCreatesClipAndPendingTask() {
        SaveClipResult result = clipService.save(new SaveClipRequest(
                "某动画 第3集", "https://www.bilibili.com/video/BV1", 754.5, "高燃战斗", "主角觉醒"));

        assertFalse(result.deduped());
        assertNotNull(result.id());
        assertEquals("PENDING", taskMapper.selectById(result.id()).getStatus());
    }

    @Test
    void saveSameUrlWithin3SecondsDeduplicates() {
        SaveClipRequest req = new SaveClipRequest(
                "某动画 第3集", "https://www.bilibili.com/video/BV2", 100.0, "战斗", "");

        SaveClipResult first = clipService.save(req);
        SaveClipResult second = clipService.save(req);

        assertTrue(second.deduped());
        assertEquals(first.id(), second.id());
    }

    @Test
    void saveSameUrlWithDifferentTagIsNewRecord() {
        SaveClipRequest first = new SaveClipRequest(
                "某动画", "https://www.bilibili.com/video/BV3", 100.0, "战斗", "");
        SaveClipRequest second = new SaveClipRequest(
                "某动画", "https://www.bilibili.com/video/BV3", 100.0, "泪目", "");

        SaveClipResult r1 = clipService.save(first);
        SaveClipResult r2 = clipService.save(second);

        assertFalse(r2.deduped());
        assertNotEquals(r1.id(), r2.id());
    }

    @Test
    void updateChangesTagAndResetsEmbeddingTask() {
        SaveClipResult saved = clipService.save(new SaveClipRequest(
                "某动画", "https://b.com/1", 10.0, "高燃", "旧备注"));

        Clip updated = clipService.update(saved.id(),
                new SaveClipRequest("某动画", "https://b.com/1", 10.0, "名场面", "新备注"), false);

        assertEquals("名场面", updated.getTag());
        assertEquals("PENDING", taskMapper.selectById(saved.id()).getStatus());
    }

    @Test
    void updateAppendTagMergesTags() {
        SaveClipResult saved = clipService.save(new SaveClipRequest(
                "某动画", "https://b.com/2", 20.0, "高燃", ""));

        Clip updated = clipService.update(saved.id(),
                new SaveClipRequest("某动画", "https://b.com/2", 20.0, "名场面", ""), true);

        assertTrue(updated.getTag().contains("高燃"));
        assertTrue(updated.getTag().contains("名场面"));
    }

    @Test
    void findNearbyReturnsClipsWithinWindow() {
        clipService.save(new SaveClipRequest("某动画", "https://n.com/1", 100.0, "高燃", ""));
        clipService.save(new SaveClipRequest("某动画", "https://n.com/1", 105.0, "名场面", ""));
        clipService.save(new SaveClipRequest("某动画", "https://n.com/1", 200.0, "泪目", ""));

        List<Clip> nearby = clipService.findNearby("https://n.com/1", 102.0, 10.0);

        assertEquals(2, nearby.size());
        assertEquals("高燃", nearby.get(0).getTag());
    }

    @Test
    void getReturnsFullClipForDetailPage() {
        SaveClipResult saved = clipService.save(new SaveClipRequest(
                "某动画 第3集", "https://get.com/1", 42.0, "高燃", "名场面备注"));

        Clip clip = clipService.get(saved.id());
        assertEquals(42.0, clip.getTimestampSec());
        assertEquals("高燃", clip.getTag());
        assertEquals("名场面备注", clip.getNote());
        assertNotNull(clip.getVideoFp());
        assertNotNull(clip.getEpisodeId());
        assertThrows(NoSuchElementException.class, () -> clipService.get(999999L));
    }

    @Test
    void deleteRemovesClipAndTask() {
        SaveClipResult saved = clipService.save(new SaveClipRequest(
                "某动画", "https://b.com/3", 30.0, "高燃", ""));

        assertTrue(clipService.delete(saved.id()));
        assertFalse(clipService.delete(saved.id())); // 二次删除返回 false
        assertNull(taskMapper.selectById(saved.id()));
    }
}
