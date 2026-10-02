package com.videotagger.mapper;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Clip;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ClipMapperIT extends AbstractMySqlIT {

    @Autowired
    ClipMapper clipMapper;

    @Test
    void insertAndSelectById() {
        Clip clip = new Clip();
        clip.setTitle("某动画 第3集");
        clip.setUrl("https://www.bilibili.com/video/BV1xx");
        clip.setTimestampSec(754.5);
        clip.setNote("主角觉醒");
        clip.setCreatedAt(System.currentTimeMillis());

        clipMapper.insert(clip);

        Clip loaded = clipMapper.selectById(clip.getId());
        assertNotNull(loaded);
        assertEquals("某动画 第3集", loaded.getTitle());
        assertEquals(754.5, loaded.getTimestampSec());
    }
}
