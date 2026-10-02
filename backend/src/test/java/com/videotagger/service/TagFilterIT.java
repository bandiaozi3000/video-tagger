package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.TestTagSeed;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Media;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * v0.31 标签「两个视角」的回归门禁（设计规格 §12-7/8）。
 *
 * <ul>
 *   <li><b>媒体视角</b>（筛选 / 选项字典）= **查询期三级并集**：媒体/集/片段任一层命中即算；</li>
 *   <li><b>实体视角</b>（详情页标签池）= 只看本级，不带上/下级。</li>
 * </ul>
 *
 * 三级不再落库同步，所以这里同时证明「没有同步也能筛出来」。
 */
class TagFilterIT extends AbstractMySqlIT {

    @Autowired
    ClipService clipService;
    @Autowired
    MediaService mediaService;
    @Autowired
    TagAdminService tagAdminService;
    @Autowired
    MediaMapper mediaMapper;
    @Autowired
    EpisodeMapper episodeMapper;
    @Autowired
    TagMapper tagMapper;
    @Autowired
    EpisodeService episodeService;

    private Media media(String title) {
        Media m = new Media();
        m.setTitle(title);
        m.setMediaFormat("VIDEO");
        m.setStatus("WANT");
        m.setConfirmed(1);
        m.setCreatedAt(System.currentTimeMillis());
        mediaMapper.insert(m);
        return m;
    }

    /** 只给**片段**打标签（媒体级与集级都不碰）→ 验证媒体视角能筛到、实体视角看不见。 */
    @Test
    void clipLevelTagIsVisibleToMediaFilterButNotToMediaPool() {
        Media m = media("视角探针甲");
        // 打标保存会按标题归组建立集，并新建片段
        SaveClipResult saved = clipService.save(new SaveClipRequest(
                "视角探针甲 第1集", "https://tag-filter.test/a", 10.0,
                List.of(TestTagSeed.ensure(tagMapper, "片段层探针")), ""));
        Long clipId = saved.id();
        Episode ep = episodeMapper.selectByFp(com.videotagger.util.VideoFingerprint.fingerprint("https://tag-filter.test/a"));
        long tagId = TestTagSeed.ensure(tagMapper, "片段层探针");

        // 媒体视角：媒体墙筛选命中（三级任一层）
        List<Long> filtered = mediaService.list(50, 0, null, null, null, null, null, null, null, null, null,
                List.of(tagId), "AND", null, null, null, null).stream().map(s -> s.id()).toList();
        assertTrue(filtered.contains(m.getId()), "片段级标签必须能被媒体墙筛出来（查询期三级并集）");

        // 选项字典同口径：得列出该标签，且计数 ≥ 1（否则面板里根本选不到）
        assertTrue(mediaService.tagCounts().stream()
                        .anyMatch(t -> t.tagId().equals(tagId) && t.count() >= 1),
                "筛选面板的标签选项字典也要按三级并集统计");

        // 实体视角：媒体自己的标签池不该出现它（没同步）
        assertFalse(tagAdminService.list("", m.getId(), 1, 50).items().stream()
                        .anyMatch(u -> u.name().equals("片段层探针")),
                "媒体详情标签池是实体视角：只列媒体自己挂的标签");
        assertFalse(tagAdminService.list("", null, 1, 50).items().isEmpty(), "通用池仍有词条");

        // 集详情标签池同样只算集自己（片段标签不上浮）
        assertFalse(tagAdminService.episodeStats(ep.getId()).stream()
                        .anyMatch(u -> u.name().equals("片段层探针")));

        // cleanup：删掉片段与媒体，避免影响其它 IT 的计数断言
        clipService.delete(clipId);
        mediaMapper.deleteById(m.getId());
    }

    /** 多标签 AND：两个标签落在**不同层级**，仍算同一媒体命中。 */
    @Test
    void multiTagAndMatchesAcrossLevels() {
        Media m = media("视角探针乙");
        clipService.save(new SaveClipRequest("视角探针乙 第1集", "https://tag-filter.test/b", 10.0,
                List.of(TestTagSeed.ensure(tagMapper, "片段层探针B")), ""));
        Episode ep = episodeMapper.selectByFp(com.videotagger.util.VideoFingerprint.fingerprint("https://tag-filter.test/b"));
        long episodeTag = TestTagSeed.ensure(tagMapper, "集层探针B");
        episodeService.addTags(ep.getId(), List.of(episodeTag));
        long clipTag = TestTagSeed.ensure(tagMapper, "片段层探针B");

        List<Long> and = mediaService.list(50, 0, null, null, null, null, null, null, null, null, null,
                List.of(clipTag, episodeTag), "AND", null, null, null, null).stream().map(s -> s.id()).toList();
        assertTrue(and.contains(m.getId()), "AND 的语义是每个标签各自三级命中，不要求落在同一条记录上");

        List<Long> or = mediaService.list(50, 0, null, null, null, null, null, null, null, null, null,
                List.of(clipTag, episodeTag), "OR", null, null, null, null).stream().map(s -> s.id()).toList();
        assertTrue(or.containsAll(and), "OR 结果必须包含 AND 结果");
        assertEquals(1, tagAdminService.episodeStats(ep.getId()).size(), "集池只有集自己那一个标签");
    }
}
