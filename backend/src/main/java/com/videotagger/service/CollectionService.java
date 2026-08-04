package com.videotagger.service;

import com.videotagger.entity.Collection;
import com.videotagger.mapper.MediaCollectionMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.CollectionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

/** 收藏夹（自定义清单）：多对多挂番剧，仅作筛选/整体浏览。 */
@Service
public class CollectionService {

    private final CollectionMapper collectionMapper;
    private final MediaCollectionMapper mediaCollectionMapper;
    private final MediaMapper mediaMapper;

    public CollectionService(CollectionMapper collectionMapper, MediaCollectionMapper mediaCollectionMapper,
                             MediaMapper mediaMapper) {
        this.collectionMapper = collectionMapper;
        this.mediaCollectionMapper = mediaCollectionMapper;
        this.mediaMapper = mediaMapper;
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
        mediaCollectionMapper.deleteByCollection(id);
        collectionMapper.deleteById(id);
    }

    public void addMedia(Long collectionId, Long mediaId) {
        requireCollection(collectionId);
        mediaCollectionMapper.insertIgnore(mediaId, collectionId);
    }

    public void removeMedia(Long collectionId, Long mediaId) {
        requireCollection(collectionId);
        mediaCollectionMapper.deleteLink(mediaId, collectionId);
    }

    /** 收藏夹内容（整体浏览）。 */
    public List<MediaSummary> media(Long collectionId) {
        requireCollection(collectionId);
        return mediaMapper.listByCollection(collectionId, 100);
    }

    private Collection requireCollection(Long id) {
        Collection c = collectionMapper.selectById(id);
        if (c == null) {
            throw new NoSuchElementException("collection not found: " + id);
        }
        return c;
    }
}
