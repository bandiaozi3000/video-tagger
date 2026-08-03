package com.videotagger.service;

import com.videotagger.entity.Collection;
import com.videotagger.mapper.AnimeCollectionMapper;
import com.videotagger.mapper.AnimeMapper;
import com.videotagger.mapper.CollectionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

/** 收藏夹（自定义清单）：多对多挂番剧，仅作筛选/整体浏览。 */
@Service
public class CollectionService {

    private final CollectionMapper collectionMapper;
    private final AnimeCollectionMapper animeCollectionMapper;
    private final AnimeMapper animeMapper;

    public CollectionService(CollectionMapper collectionMapper, AnimeCollectionMapper animeCollectionMapper,
                             AnimeMapper animeMapper) {
        this.collectionMapper = collectionMapper;
        this.animeCollectionMapper = animeCollectionMapper;
        this.animeMapper = animeMapper;
    }

    public List<CollectionSummary> list() {
        return collectionMapper.listSummaries();
    }

    public Collection create(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name 不能为空");
        }
        Collection c = new Collection();
        c.setName(name.trim());
        c.setCreatedAt(System.currentTimeMillis());
        collectionMapper.insert(c);
        return c;
    }

    @Transactional
    public void delete(Long id) {
        requireCollection(id);
        animeCollectionMapper.deleteByCollection(id);
        collectionMapper.deleteById(id);
    }

    public void addAnime(Long collectionId, Long animeId) {
        requireCollection(collectionId);
        animeCollectionMapper.insertIgnore(animeId, collectionId);
    }

    public void removeAnime(Long collectionId, Long animeId) {
        requireCollection(collectionId);
        animeCollectionMapper.deleteLink(animeId, collectionId);
    }

    /** 收藏夹内容（整体浏览）。 */
    public List<AnimeSummary> anime(Long collectionId) {
        requireCollection(collectionId);
        return animeMapper.listByCollection(collectionId, 100);
    }

    private Collection requireCollection(Long id) {
        Collection c = collectionMapper.selectById(id);
        if (c == null) {
            throw new NoSuchElementException("collection not found: " + id);
        }
        return c;
    }
}
