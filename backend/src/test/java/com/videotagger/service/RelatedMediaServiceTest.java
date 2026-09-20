package com.videotagger.service;

import com.videotagger.mapper.ExternalRelationMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 同系列条目解析（跨媒体借片段的来源）。设计规格 §5.1。
 *
 * 用《草莓棉花糖》的真实形态做样本：TV(6917) 关联里只有两条「番外篇」能反查到本地 media，
 * 其中 6672 没有片段（借不到、不该列），6648 有 1 个片段（该列）。
 */
class RelatedMediaServiceTest {

    private RelatedMediaService service(List<LinkedRelation> rows) {
        ExternalRelationMapper mapper = mock(ExternalRelationMapper.class);
        when(mapper.listLinkedMedia(anyLong())).thenReturn(rows == null ? List.of() : rows);
        return new RelatedMediaService(mapper);
    }

    @Test
    void onlyVideoRelatedEntriesWithClipsAreListed() {
        List<RelatedMedia> list = service(List.of(
                new LinkedRelation("番外篇", "草莓棉花糖 OVA 1卷", 6672L, 2007, 0L),      // 没片段 → 不列
                new LinkedRelation("番外篇", "草莓棉花糖 OVA 2卷", 6648L, 2007, 1L),      // 该列
                new LinkedRelation("广播剧", "苺ましまろ Drama CD", 9001L, 2006, 3L),      // 非视频类 → 不列
                new LinkedRelation("片头曲", "いちごコンプリート", 9002L, 2005, 2L),      // 非视频类 → 不列
                new LinkedRelation("游戏", "草莓棉花糖", 9003L, 2009, 5L))).videoRelated(6917L);

        assertEquals(1, list.size());
        assertEquals(6648L, list.get(0).mediaId());
        assertEquals("番外篇", list.get(0).relationType());
        assertEquals(1L, list.get(0).clipCount());
    }

    @Test
    void selfReferenceAndUnknownRowsAreSkipped() {
        List<RelatedMedia> list = service(List.of(
                new LinkedRelation("番外篇", "自己", 6917L, 2005, 9L),      // 自引用 → 不列
                new LinkedRelation("番外篇", "没连本地媒体", null, null, null),
                new LinkedRelation(null, "没类型", 9004L, 2000, 1L))).videoRelated(6917L);
        assertTrue(list.isEmpty());
    }

    @Test
    void duplicateEntriesAreDedupedKeepingFirst() {
        List<RelatedMedia> list = service(List.of(
                new LinkedRelation("番外篇", "OVA 第2期", 6648L, 2007, 1L),
                new LinkedRelation("主线故事", "OVA 第2期（另一条关联指向同一个本地媒体）", 6648L, 2007, 1L))).videoRelated(6917L);
        assertEquals(1, list.size());
        assertEquals("番外篇", list.get(0).relationType());   // 保留先出现的那条
    }

    @Test
    void sortedByWhitelistOrderThenClipCount() {
        List<RelatedMedia> list = service(List.of(
                new LinkedRelation("角色出演", "角色出演 A", 100L, 2010, 9L),
                new LinkedRelation("番外篇", "番外 B", 101L, 2010, 1L),
                new LinkedRelation("番外篇", "番外 A", 102L, 2010, 5L),
                new LinkedRelation("主线故事", "主线", 103L, 2010, 1L))).videoRelated(6917L);

        // 白名单顺序 = 主线故事 → 前传 → 续集 → 番外篇 → 剧场版 → 角色出演 → 同一世界观
        assertEquals(List.of(103L, 102L, 101L, 100L),
                list.stream().map(RelatedMedia::mediaId).toList());
    }

    @Test
    void noRelationsReturnsEmpty() {
        assertTrue(service(new ArrayList<>()).videoRelated(6917L).isEmpty());
        assertTrue(service(null).videoRelated(6917L).isEmpty());
    }

    @Test
    void whitelistHasNoCatchAllType() {
        // 用户 2026-09-20 定稿：去掉「其他」这种 catch-all，避免把 CD/书籍全拉进来
        assertTrue(RelatedMediaService.VIDEO_RELATION_TYPES.contains("番外篇"));
        assertTrue(RelatedMediaService.VIDEO_RELATION_TYPES.contains("同一世界观"));
        assertTrue(!RelatedMediaService.VIDEO_RELATION_TYPES.contains("其他"));
        assertTrue(!RelatedMediaService.VIDEO_RELATION_TYPES.contains("广播剧"));
    }
}
