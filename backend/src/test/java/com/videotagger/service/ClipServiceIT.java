package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.mapper.EmbeddingTaskMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

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
}
