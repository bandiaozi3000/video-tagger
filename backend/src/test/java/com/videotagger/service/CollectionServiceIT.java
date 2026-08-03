package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Anime;
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
    AnimeService animeService;
    @Autowired
    CollectionMapper collectionMapper;

    @Test
    void createAddRemoveAnimeAndDelete() {
        Collection c = collectionService.create("补番清单");
        assertNotNull(c.getId());
        assertEquals("补番清单", c.getName());

        Anime a = animeService.create(new AnimeRequest("测试番", "ANIME", "WANT", null));

        collectionService.addAnime(c.getId(), a.getId());
        assertEquals(1, collectionService.anime(c.getId()).size());

        collectionService.removeAnime(c.getId(), a.getId());
        assertEquals(0, collectionService.anime(c.getId()).size());

        collectionService.delete(c.getId());
        assertNull(collectionMapper.selectById(c.getId()));
    }
}
