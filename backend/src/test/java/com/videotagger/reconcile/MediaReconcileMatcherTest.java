package com.videotagger.reconcile;

import com.videotagger.metadata.MetadataRecord;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 匹配器的行为钉死。每条样本都来自 2026-09-25 对真 Bangumi 接口的实测（设计规格 §4.3/§4.4），
 * 不联网、用内联候选复现当时的真实响应形态。
 */
class MediaReconcileMatcherTest {

    /** 造一条 Bangumi 候选；nameCn 用 canonicalTitle（与 provider 的解析一致）。 */
    private static MetadataRecord rec(String id, String nameCn, String nativeName, Integer year, Integer eps,
                                      String... aliases) {
        return new MetadataRecord("BANGUMI", id, nameCn, nativeName, null, null,
                List.of(aliases), null, null, List.of(), "TV", year, null, null, null, eps,
                List.of(), List.of(), null);
    }

    @Test
    void 别名命中_这是把命中率从8percent拉到72percent的关键() {
        // 真样本：本地「描绘直至生命尽头」↔ Bangumi 545917「画完这个再去死」，
        // 对 name_cn 相似度是 0.00，但**本地标题就写在 infobox 别名里**
        MetadataRecord target = rec("545917", "画完这个再去死", "これ描いて死ね", 2025, null,
                "描绘直至生命尽头", "畫完這個再去死", "Kore Kaite Shine", "Draw This, Then Die!", "画完这个就去死");
        List<MetadataRecord> candidates = List.of(
                rec("999001", "TIME DRIVER 我们所描绘的未来", null, 2024, null),
                target);

        MediaReconcileMatcher.Match match =
                MediaReconcileMatcher.best(candidates, "描绘直至生命尽头", 2025, null);

        assertNotNull(match);
        assertEquals("545917", match.externalId());
        assertTrue(match.exact());
        assertEquals("alias", match.via());
    }

    @Test
    void 不得把轻松熊误判成摇曳百合() {
        // 真样本：旧信号 matchType=EXTERNAL_ID 在这里给出「摇曳百合」——因为搜索太宽，
        // 20 条里混进了一个已关联的不相干条目。精确/别名判定必须挡住。
        List<MetadataRecord> candidates = List.of(
                rec("5837", "摇曳百合", "ゆるゆり", 2011, 12),
                rec("600001", "轻松熊", "リラックマ", 2026, null));

        MediaReconcileMatcher.Match match = MediaReconcileMatcher.best(candidates, "轻松熊", 2026, null);

        assertNotNull(match);
        assertEquals("600001", match.externalId());
        assertTrue(match.exact());
    }

    @Test
    void 同名多季时_必须命中同名那条而不是相邻季() {
        // 真样本：本地「北斗神拳 拳王军杂兵们的挽歌」相似度 0.81 曾被错配到「…挽歌 第二季」
        List<MetadataRecord> candidates = List.of(
                rec("7571", "北斗神拳 拳王军杂兵们的挽歌 第二季", null, 2026, null),
                rec("700002", "北斗神拳 拳王军杂兵们的挽歌", null, 2025, null));

        MediaReconcileMatcher.Match match =
                MediaReconcileMatcher.best(candidates, "北斗神拳 拳王军杂兵们的挽歌", 2025, null);

        assertNotNull(match);
        assertEquals("700002", match.externalId());
        assertTrue(match.exact());
    }

    @Test
    void 相似度兜底_斗球儿弹子对弹平_只能进人工不自动() {
        // 实测相似度正好 0.80：达到阈值但要标成「非精确」，调用方据此走人工确认层（②）
        List<MetadataRecord> candidates = List.of(rec("800001", "斗球儿弹平", "ドッジ弾平", 1991, null));

        MediaReconcileMatcher.Match match = MediaReconcileMatcher.best(candidates, "斗球儿弹子", null, null);

        assertNotNull(match);
        assertFalse(match.exact(), "0.80 的相似命中绝不能标成精确命中");
        assertEquals(0.8, match.score(), 1e-9);
    }

    @Test
    void 相似度兜底时年份对不上应出局() {
        List<MetadataRecord> candidates = List.of(rec("800002", "斗球儿弹平", null, 1991, null));

        assertNull(MediaReconcileMatcher.best(candidates, "斗球儿弹子", 2026, null));
    }

    @Test
    void 多候选精确同名_用年份消歧() {
        List<MetadataRecord> candidates = List.of(
                rec("900001", "黄泉使者", null, 2024, null),
                rec("900002", "黄泉使者", null, 2026, null));

        MediaReconcileMatcher.Match match = MediaReconcileMatcher.best(candidates, "黄泉的使者", 2026, null);
        // 「黄泉的使者」与「黄泉使者」差一个字 —— 归一化后不等，走相似度兜底并受年份约束
        assertNotNull(match);
        assertEquals("900002", match.externalId());

        // 完全同名的情况：年份必须把 2026 那条挑出来
        List<MetadataRecord> sameName = List.of(
                rec("900003", "黄泉使者", null, 2024, null),
                rec("900004", "黄泉使者", null, 2026, null));
        MediaReconcileMatcher.Match exact = MediaReconcileMatcher.best(sameName, "黄泉使者", 2026, null);
        assertNotNull(exact);
        assertTrue(exact.exact());
        assertEquals("900004", exact.externalId());
    }

    @Test
    void 多候选同名且年份集数都分不开_交人工返回null() {
        List<MetadataRecord> candidates = List.of(
                rec("910001", "同名作品", null, 2026, 12),
                rec("910002", "同名作品", null, 2026, 12));

        assertNull(MediaReconcileMatcher.best(candidates, "同名作品", 2026, 12));
    }

    @Test
    void 没有候选或标题为空都返回null() {
        assertNull(MediaReconcileMatcher.best(List.of(), "随便", null, null));
        assertNull(MediaReconcileMatcher.best(null, "随便", null, null));
        assertNull(MediaReconcileMatcher.best(
                List.of(rec("920001", "作品", null, 2026, null)), "   ", null, null));
    }
}
