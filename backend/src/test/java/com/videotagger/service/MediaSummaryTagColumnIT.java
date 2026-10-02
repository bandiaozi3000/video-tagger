package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.TestTagSeed;
import com.videotagger.entity.Media;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * v0.31 卡片标签列（`MediaSummary.tags`）的映射门禁。
 *
 * <p>为什么单独测：`MediaSummary` 是**按位映射**的 record，而 `tags` 是第 18 个字段、
 * 由 `MediaMapper.TAG_NAMES_COL` 追加到 **4 条卡片查询**的列尾。加在末尾才不会打乱顺序 ——
 * 但一旦哪条查询漏加/错位，只有跑真实查询才会暴露（编译期看不出来）。
 * 「最近观看」(`listByLatest`) 与 `listSummaries` 原本没有任何测试覆盖，这里一并钉住。
 */
class MediaSummaryTagColumnIT extends AbstractMySqlIT {

    @Autowired
    ClipService clipService;
    @Autowired
    MediaService mediaService;
    @Autowired
    MediaMapper mediaMapper;
    @Autowired
    TagMapper tagMapper;

    @Test
    void allFourCardQueriesCarryTagsColumn() {
        long tagId = TestTagSeed.ensure(tagMapper, "卡片列探针");
        // 片段级标签 → 媒体视角并集应当出现在卡片标签列里
        clipService.save(new SaveClipRequest("卡片列探针 第1集", "https://tag-col.test/a", 10.0,
                List.of(tagId), ""));

        List<MediaSummary> filtered = mediaService.list(50, 0, null, null, null, null, null, null, null, null, null,
                List.of(tagId), "AND", "卡片列探针", null, null, null);
        assertTrue(filtered.stream().anyMatch(m -> m.tags() != null && m.tags().contains("卡片列探针")),
                "listFiltered（全部媒体 tab）必须带回 tags，且含片段级标签");

        // 最近观看 tab（listByLatest）—— 原本零覆盖
        List<MediaSummary> recent = mediaService.recent(50, 0, null, null, null, null, null, null, null,
                "卡片列探针", List.of(tagId), "AND", List.of(), null);
        assertTrue(recent.stream().anyMatch(m -> m.tags() != null && m.tags().contains("卡片列探针")),
                "listByLatest（最近观看 tab）也必须带回 tags");

        // listSummaries：另一个复用同一 record 的查询
        List<MediaSummary> plain = mediaMapper.listSummaries(50, 0);
        MediaSummary hit = plain.stream().filter(m -> "卡片列探针".equals(m.title())).findFirst().orElse(null);
        assertNotNull(hit, "listSummaries 应能查到刚建的媒体");
        assertTrue(hit.tags() != null && hit.tags().contains("卡片列探针"), "listSummaries 也要带回 tags");
    }
}
