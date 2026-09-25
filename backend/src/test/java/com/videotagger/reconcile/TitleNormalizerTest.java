package com.videotagger.reconcile;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 归一化的行为钉死。样本取自 2026-09-25 对真 Bangumi 接口的 40 条实测（设计规格 §4.3/§4.4）。
 */
class TitleNormalizerTest {

    @Test
    void 全半角与空格标点都是书写差异_应判相等() {
        assertTrue(TitleNormalizer.same("暗芝居第十七季", "暗芝居 第十七季"));
        assertTrue(TitleNormalizer.same("第１季", "第1季"));
        assertTrue(TitleNormalizer.same("碧蓝航线 微速前行第二季", "碧蓝航线：微速前行！第二季"));
        assertTrue(TitleNormalizer.same("Grow Up Show～向日葵马戏团～", "Grow Up Show ～向日葵马戏团～"));
    }

    @Test
    void 中文数字与阿拉伯数字应判相等() {
        assertTrue(TitleNormalizer.same("入间同学入魔了第四季", "入间同学入魔了 第4季"));
        assertTrue(TitleNormalizer.same("暗芝居第十七季", "暗芝居第17季"));
        assertTrue(TitleNormalizer.same("第二季 第2部分", "第2季 第二部分"));
    }

    @Test
    void 噪声后缀_篇章部分_应被抹掉() {
        assertTrue(TitleNormalizer.same("剧场版 X 红莲之绊篇", "剧场版 X 红莲之绊"));
        assertTrue(TitleNormalizer.same("铠真传 武士骑兵 2", "铠真传 武士骑兵 第2部分"));
    }

    @Test
    void 季与集是区分标识_绝不能抹() {
        assertFalse(TitleNormalizer.same("关于我转生变成史莱姆这档事第二季", "关于我转生变成史莱姆这档事第三季"));
        assertFalse(TitleNormalizer.same("北斗神拳 拳王军杂兵们的挽歌", "北斗神拳 拳王军杂兵们的挽歌 第二季"));
        assertFalse(TitleNormalizer.same("史莱姆 第1集", "史莱姆 第2集"));
    }

    @Test
    void 空标题不参与判等() {
        assertFalse(TitleNormalizer.same(null, null));
        assertFalse(TitleNormalizer.same("", ""));
        assertEquals("", TitleNormalizer.normalize(null));
        assertEquals(0.0, TitleNormalizer.similarity("", "随便"));
    }

    @Test
    void 相似度_一个字的差异() {
        // 「斗球儿弹子 → 斗球儿弹平」实测 0.80 —— 这条走人工，不自动
        assertEquals(0.8, TitleNormalizer.similarity("斗球儿弹子", "斗球儿弹平"), 1e-9);
        assertEquals(1.0, TitleNormalizer.similarity("同名", "同名"), 1e-9);
    }

    @Test
    void 不相关的标题相似度应该很低() {
        // 「轻松熊」曾被误判成「摇曳百合」，归一化后必须毫无重叠
        assertTrue(TitleNormalizer.similarity("轻松熊", "摇曳百合") < 0.2);
        assertTrue(TitleNormalizer.similarity("描绘直至生命尽头", "画完这个再去死") < 0.3);
    }
}
