package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Collection;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.Media;
import com.videotagger.mapper.CollectionMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaCollectionMapper;
import com.videotagger.mapper.MediaMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * v0.32 媒体页筛选**多选**的门禁。
 *
 * <p>为什么必须有这个测试：这次把 6 个维度从「单选 =」改成「多选 IN」，一次动了 5 条 SQL
 * （`listFiltered` / `listByLatest` / `countFiltered` / `countLatest` / `listExportRows`），
 * 编译期看不出漏改哪条 —— 漏掉的那条会**静默忽略条件**（2026-09-25 同类坑）。
 * 同时这里也是 `JSON_CONTAINS(genres_json, JSON_QUOTE(?))` 这个「且」分支在**真 MySQL** 上的唯一验证。
 *
 * <p>隔离手段：三部探针媒体标题带同一段唯一前缀，每条查询都带 `q=前缀`，
 * 不与其他 IT 往同一个容器里塞的数据互相污染。
 */
class MediaFilterMultiIT extends AbstractMySqlIT {

    @Autowired
    MediaService mediaService;
    @Autowired
    MediaMapper mediaMapper;
    @Autowired
    ExternalWorkMapper externalWorkMapper;
    @Autowired
    CollectionMapper collectionMapper;
    @Autowired
    MediaCollectionMapper mediaCollectionMapper;

    /** 唯一前缀，避免与同容器内其他 IT 的数据串味。 */
    private final String prefix = "多选探针" + System.nanoTime();
    private long a;
    private long b;
    private long c;
    private long coll1;
    private long coll2;

    @BeforeEach
    void seed() {
        // A: 2020 / WATCHING / 奇幻+战斗 / SPRING / 夹1
        // B: 2021 / WANT     / 奇幻      / FALL   / 夹1+夹2
        // C: 2021 / WATCHING / 恋爱      / 无季度 / 夹2
        a = media("A", 2020, "WATCHING");
        b = media("B", 2021, "WANT");
        c = media("C", 2021, "WATCHING");
        work(a, "[\"奇幻\",\"战斗\"]", "SPRING");
        work(b, "[\"奇幻\"]", "FALL");
        work(c, "[\"恋爱\"]", null);
        coll1 = collection("夹1");
        coll2 = collection("夹2");
        mediaCollectionMapper.insertIgnore(a, coll1);
        mediaCollectionMapper.insertIgnore(b, coll1);
        mediaCollectionMapper.insertIgnore(b, coll2);
        mediaCollectionMapper.insertIgnore(c, coll2);
    }

    @Test
    void yearAndStatusMultiSelectAreUnions() {
        assertEquals(List.of(a), query(null, List.of(2020), null, null, null, null, null),
                "年份单选 2020 只应命中 A");
        assertEquals(ids(a, b, c), query(null, List.of(2020, 2021), null, null, null, null, null),
                "年份多选 = 并集（单值列，没有「且」这种可能）");
        assertEquals(ids(a, c), query(List.of("WATCHING"), null, null, null, null, null, null),
                "状态多选走 IN");
        assertEquals(ids(a, b, c), query(List.of("WATCHING", "WANT"), null, null, null, null, null, null),
                "状态多选 = 并集");
    }

    @Test
    void seasonMultiSelectIsUnion() {
        assertEquals(ids(a, b), query(null, null, List.of("SPRING", "FALL"), null, null, null, null),
                "季度多选 = 并集");
        assertEquals(List.of(a), query(null, null, List.of("SPRING"), null, null, null, null), "季度单选不变");
    }

    @Test
    void genreAnyAndAll() {
        assertEquals(ids(a, b, c), query(null, null, null, null, null, List.of("奇幻", "恋爱"), "OR"),
                "题材 OR = 命中任一（历史语义不变）");
        assertEquals(List.of(a), query(null, null, null, null, null, List.of("奇幻", "战斗"), "AND"),
                "题材 AND = 每个词都要有（JSON_CONTAINS + JSON_QUOTE 路径）");
        assertEquals(ids(a, b), query(null, null, null, null, null, List.of("奇幻"), "AND"),
                "题材 AND 下单个词 = 该词的结果（与 OR 等价）");
        assertTrue(query(null, null, null, null, null, List.of("奇幻", "恋爱"), "AND").isEmpty(),
                "题材 AND 无交集 → 空集（且会退化为空，这正是单值维度不给开关的理由）");
    }

    @Test
    void collectionAnyAndAll() {
        assertEquals(ids(a, b, c), query(null, null, null, List.of(coll1, coll2), "OR", null, null),
                "收藏夹 OR = 在任一夹里");
        assertEquals(List.of(b), query(null, null, null, List.of(coll1, coll2), "AND", null, null),
                "收藏夹 AND = 同时在两个夹里");
        assertEquals(ids(b, c), query(null, null, null, List.of(coll2), "AND", null, null),
                "收藏夹单选不变（B 同时属于两个夹，所以在夹2 里）");
    }

    @Test
    void countAndLatestHonourTheSameConditions() {
        List<Long> hits = query(null, null, null, List.of(coll1, coll2), "AND", List.of("奇幻"), "AND");
        assertEquals(List.of(b), hits, "跨维度仍是 AND：夹1+夹2 且 含奇幻");
        assertEquals(1, mediaService.count(null, null, null, null, List.of(coll1, coll2), null, null, null, null,
                "AND", "AND", false, prefix, List.of("奇幻"), null), "countFiltered 必须与 list 同条件");
        // 换个维度再对一次：count 与 list 的**位置参数顺序**一旦错位，同参同条件就会数不上
        // （本次就是这么抓到 countFiltered 的 genreMode/q 错位的）
        assertEquals(1, mediaService.count(List.of("WATCHING"), null, null, null, null, List.of(2021), null, null,
                null, null, null, false, prefix, null, null), "countFiltered 多维度组合也要与 list 对齐（WATCHING 且 2021 = C）");
    }

    /** 全维度走查：所有参数默认 null = 不筛，只留 q=前缀 圈定这三部探针。 */
    private List<Long> query(List<String> status, List<Integer> year, List<String> season,
                             List<Long> collections, String collectionMode,
                             List<String> genres, String genreMode) {
        return mediaService.list(50, 0, status, null, null, null, collections, null, null, year, null,
                        null, null, genreMode, collectionMode, prefix, null, genres, season)
                .stream().map(MediaSummary::id).sorted().toList();
    }

    private List<Long> ids(long... v) {
        long[] copy = v.clone();
        java.util.Arrays.sort(copy);
        return java.util.Arrays.stream(copy).boxed().toList();
    }

    private long media(String tag, Integer year, String status) {
        Media m = new Media();
        m.setTitle(prefix + tag);
        m.setYear(year);
        m.setStatus(status);
        m.setCreatedAt(System.currentTimeMillis());
        mediaMapper.insert(m);
        return m.getId();
    }

    private void work(long mediaId, String genresJson, String season) {
        ExternalWork w = new ExternalWork();
        w.setProvider("BANGUMI");
        w.setExternalId(prefix + mediaId);
        w.setMediaId(mediaId);
        w.setGenresJson(genresJson);
        w.setSeason(season);
        w.setSyncState("OK");
        long now = System.currentTimeMillis();
        w.setCreatedAt(now);
        w.setUpdatedAt(now);
        externalWorkMapper.insert(w);
    }

    private long collection(String name) {
        Collection c = new Collection();
        c.setName(prefix + name);
        c.setCreatedAt(System.currentTimeMillis());
        collectionMapper.insert(c);
        return c.getId();
    }
}
