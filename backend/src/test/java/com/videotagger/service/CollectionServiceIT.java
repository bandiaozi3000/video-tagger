package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Media;
import com.videotagger.entity.Collection;
import com.videotagger.mapper.CollectionMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/** 收藏夹：创建、挂载/卸载番剧、清单查询、删除。 */
class CollectionServiceIT extends AbstractMySqlIT {

    @Autowired
    CollectionService collectionService;
    @Autowired
    MediaService mediaService;
    @Autowired
    CollectionMapper collectionMapper;

    @Test
    void createAddRemoveMediaAndDelete() {
        Collection c = collectionService.create("补番清单");
        assertNotNull(c.getId());
        assertEquals("补番清单", c.getName());

        Media a = mediaService.create(new MediaRequest("测试番", "VIDEO", "番剧", "WANT", null, null));

        collectionService.addMedia(c.getId(), a.getId());
        assertEquals(1, collectionService.media(c.getId(), null, null).size());

        collectionService.removeMedia(c.getId(), a.getId());
        assertEquals(0, collectionService.media(c.getId(), null, null).size());

        collectionService.delete(c.getId());
        assertNull(collectionMapper.selectById(c.getId()));
    }
}
