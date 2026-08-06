package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Media;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaTagMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 回归探针：TagUsage 是 record 且含原生 long 字段，MyBatis 构造器映射在「有数据」时才触发。
 *  countGlobal 缺 ref_count 列 / countByMedia 缺 media_count 等列时，原生 long 参数收到 null 会反射崩（500）。
 *  两查询补 0 AS 列后必须能正常构造 record。 */
class TagMapperMappingProbeIT extends AbstractMySqlIT {

    @Autowired
    TagMapper tagMapper;
    @Autowired
    MediaMapper mediaMapper;
    @Autowired
    MediaTagMapper mediaTagMapper;
    @Autowired
    TagAdminService tagAdminService;

    @Test
    void countGlobal_mapsRecord_whenRowsExist() {
        tagMapper.insertIgnore("探针通用" + System.nanoTime(), System.currentTimeMillis());
        List<TagUsage> all = tagMapper.countGlobal();
        assertFalse(all.isEmpty(), "countGlobal 至少应返回刚插入的词条");
        for (TagUsage u : all) {
            assertNotNull(u.id());
            assertNotNull(u.name());
        }
    }

    @Test
    void countByMedia_mapsRecord_whenRowsExist() {
        long now = System.currentTimeMillis();
        Media m = new Media();
        m.setTitle("探针媒体" + now);
        m.setCreatedAt(now);
        mediaMapper.insert(m);
        String tagName = "探针媒体标签" + now;
        tagMapper.insertIgnore(tagName, now);
        Tag tag = tagMapper.selectByName(tagName);
        assertNotNull(tag);
        mediaTagMapper.insertIgnore(m.getId(), tag.getId());
        List<TagUsage> byMedia = tagMapper.countByMedia(m.getId());
        assertFalse(byMedia.isEmpty(), "该媒体下应有刚关联的标签");
        assertTrue(byMedia.get(0).refCount() >= 1, "refCount 应 >=1");
    }

    @Test
    void addCreatesWordThenBatchDeleteOrphan() {
        TagUsage created = tagAdminService.add("探针新增" + System.nanoTime());
        assertNotNull(created.id());
        assertTrue(tagMapper.countGlobal().stream().anyMatch(u -> u.id().equals(created.id())),
                "新增词条应出现在通用池");

        tagAdminService.deleteBatch(List.of(created.id()));
        assertFalse(tagMapper.countGlobal().stream().anyMatch(u -> u.id().equals(created.id())),
                "批量删孤儿后词条应消失");
    }

    @Test
    void batchDeleteRejectsReferenced() {
        long now = System.currentTimeMillis();
        Media m = new Media();
        m.setTitle("探针批删" + now);
        m.setCreatedAt(now);
        mediaMapper.insert(m);
        String tagName = "探针批删标签" + now;
        tagMapper.insertIgnore(tagName, now);
        Tag tag = tagMapper.selectByName(tagName);
        assertNotNull(tag);
        mediaTagMapper.insertIgnore(m.getId(), tag.getId());

        assertThrows(IllegalArgumentException.class,
                () -> tagAdminService.deleteBatch(List.of(tag.getId())));
        assertNotNull(tagMapper.selectById(tag.getId()), "被引用词条应保留");
    }
}
