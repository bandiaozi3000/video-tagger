package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Media;
import com.videotagger.entity.Collection;
import com.videotagger.mapper.CollectionMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
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

        Media a = mediaService.create(new MediaRequest("测试番", null, null, "VIDEO", null, "番剧", "WANT", null, null, null));

        collectionService.addMedia(c.getId(), a.getId());
        assertEquals(1, collectionService.media(c.getId(), 100, 0, null, null, null, null, null, null, null, null, null).size());

        collectionService.removeMedia(c.getId(), a.getId());
        assertEquals(0, collectionService.media(c.getId(), 100, 0, null, null, null, null, null, null, null, null, null).size());

        collectionService.delete(c.getId());
        assertNull(collectionMapper.selectById(c.getId()));
    }

    @Test
    void mediaSortsByYear() {
        Collection c = collectionService.create("按年份排");
        Media old = mediaService.create(new MediaRequest("老番甲", 2015, null, "VIDEO", null, "番剧", "WANT", null, null, null));
        Media recent = mediaService.create(new MediaRequest("新番乙", 2022, null, "VIDEO", null, "番剧", "WANT", null, null, null));
        Media unknown = mediaService.create(new MediaRequest("无年份丙", null, null, "VIDEO", null, "番剧", "WANT", null, null, null));
        collectionService.addMedia(c.getId(), old.getId());
        collectionService.addMedia(c.getId(), recent.getId());
        collectionService.addMedia(c.getId(), unknown.getId());

        // 按首播年份升序：null（未知年份）排最后
        List<MediaSummary> asc = collectionService.media(c.getId(), 100, 0, null, null, null, null, null, null, null,
                "year", "asc");
        assertEquals(3, asc.size());
        assertEquals(old.getId(), asc.get(0).id());
        assertEquals(recent.getId(), asc.get(1).id());
        assertEquals(unknown.getId(), asc.get(2).id());

        // 降序：新番在前，未知年份仍排最后
        List<MediaSummary> desc = collectionService.media(c.getId(), 100, 0, null, null, null, null, null, null, null,
                "year", "desc");
        assertEquals(recent.getId(), desc.get(0).id());
        assertEquals(unknown.getId(), desc.get(2).id());
    }
}
