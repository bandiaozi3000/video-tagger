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

    /** 重命名收藏夹：空名 400（复用全局 IllegalArgumentException 处理），不存在 404。只改名字，不动关联。 */
    public Collection rename(Long id, String name) {
        Collection c = requireCollection(id);
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name 不能为空");
        }
        c.setName(name.trim());
        collectionMapper.updateById(c);
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

    /** 批量添加媒体到收藏夹（INSERT OR IGNORE 幂等，重复自动跳过）。 */
    public void batchAdd(Long collectionId, List<Long> mediaIds) {
        requireCollection(collectionId);
        if (mediaIds == null) {
            return;
        }
        for (Long mediaId : mediaIds) {
            if (mediaId != null) {
                mediaCollectionMapper.insertIgnore(mediaId, collectionId);
            }
        }
    }

    public void removeMedia(Long collectionId, Long mediaId) {
        requireCollection(collectionId);
        mediaCollectionMapper.deleteLink(mediaId, collectionId);
    }

    /** 收藏夹内容（整体浏览）；支持 status/format/子分类/confirmed/year/source/q 标题筛选，sort=year 按首播年份排序；offset 分页。
     *
     * <p>本路径的筛选**仍是单值**（收藏夹视图自己的 `collFilter` 只有一个年份框），所以在这儿
     * 把标量包成单元素列表喂给共用 SQL 片段 —— 片段只认 List，单值语义不变。 */
    public List<MediaSummary> media(Long collectionId, int limit, int offset, String status, String format,
                                    Long subcategoryId, Integer confirmed, Integer year, String source, String q,
                                    String sort, String order, List<String> genres, String season) {
        requireCollection(collectionId);
        return mediaMapper.listByCollection(collectionId, Math.max(limit, 1), Math.max(offset, 0),
                status == null ? null : List.of(status), format, subcategoryId, confirmed,
                year == null ? null : List.of(year), source, q, sort, order,
                null, null, genres, season == null ? null : List.of(season));
    }

    private Collection requireCollection(Long id) {
        Collection c = collectionMapper.selectById(id);
        if (c == null) {
            throw new NoSuchElementException("collection not found: " + id);
        }
        return c;
    }
}
