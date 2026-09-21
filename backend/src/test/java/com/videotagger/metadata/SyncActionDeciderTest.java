package com.videotagger.metadata;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 匹配 → 动作 → 计数归类（设计规格 §6）。 */
class SyncActionDeciderTest {

    @Test
    void 四种匹配对应的动作() {
        assertEquals("UPDATE", SyncActionDecider.actionFor("EXTERNAL_ID"), "稳定关联 → 更新");
        assertEquals("LINK", SyncActionDecider.actionFor("TITLE"), "标题唯一命中 → 关联并刷新（也是更新）");
        assertEquals("CREATE", SyncActionDecider.actionFor("NONE"), "本地没有 → 新增");
        assertEquals("SKIP", SyncActionDecider.actionFor("CONFLICT"), "命中多个 → 跳过，交人工");
    }

    @Test
    void 未知或空匹配一律跳过_不冒险新建() {
        assertEquals("SKIP", SyncActionDecider.actionFor(null));
        assertEquals("SKIP", SyncActionDecider.actionFor("WHATEVER"));
    }

    @Test
    void 计数归类() {
        assertEquals("added", SyncActionDecider.bucketFor("CREATE"));
        assertEquals("updated", SyncActionDecider.bucketFor("UPDATE"));
        assertEquals("updated", SyncActionDecider.bucketFor("LINK"));
        assertEquals("skipped", SyncActionDecider.bucketFor("SKIP"));
        assertEquals("skipped", SyncActionDecider.bucketFor(null));
    }
}
