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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 第四部分（媒体页分组）新增三列 `season` / `genresJson` / `collectionIds` 的映射门禁。
 *
 * <p>为什么单独测：`MediaSummary` 是**按位映射**的 record，这三列排在 `tags` 之后、
 * 由 `MediaMapper.GROUP_KEYS_COL` 追加到 **4 条卡片查询**的列尾 —— 漏加/错位编译期看不出来，
 * 只有真跑查询才会暴露（会把字符串塞进别的字段）。同时钉住取值来源：
 * 季度取 `external_work.season`、题材是**原样 JSON 串**、收藏夹是**升序逗号串**、无数据为 null。
 */
class MediaSummaryGroupKeysIT extends AbstractMySqlIT {

    @Autowired
    MediaMapper mediaMapper;
    @Autowired
    ClipService clipService;
    @Autowired
    ExternalWorkMapper externalWorkMapper;
    @Autowired
    CollectionMapper collectionMapper;
    @Autowired
    MediaCollectionMapper mediaCollectionMapper;

    private final String prefix = "分组键探针" + System.nanoTime();
    private long withAll;
    private long bare;
    private long coll1;
    private long coll2;

    @BeforeEach
    void seed() {
        withAll = media(prefix + "有季度题材夹");
        bare = media(prefix + "什么都没有");
        work(withAll, "[\"奇幻\",\"战斗\"]", "SPRING");
        // 最近观看 tab 只看「打过标记」的 → 给 withAll 挂一个片段（否则它不在 listByLatest 结果里，断言会空转）
        clipService.save(new SaveClipRequest(prefix + "有季度题材夹", "https://groupkeys.test/a", 10.0,
                List.of(), ""));
        coll1 = collection("夹一");
        coll2 = collection("夹二");
        // 故意**反序**加入：断言 collectionIds 是升序拼接，不受插入顺序影响
        mediaCollectionMapper.insertIgnore(withAll, coll2);
        mediaCollectionMapper.insertIgnore(withAll, coll1);
    }

    @Test
    void fourCardQueriesCarryGroupKeys() {
        // ① listFiltered（全部媒体 tab）
        List<MediaSummary> filtered = mediaMapper.listFiltered(null, null, null, null, null, null, null, null,
                null, null, "AND", "OR", "OR", prefix, null, null, null, 200, 0);
        assertKeys(filtered, "listFiltered");

        // ② listByLatest（最近观看 tab）
        List<MediaSummary> latest = mediaMapper.listByLatest(200, 0, null, null, null, null, null, null, null,
                prefix, null, "AND", "OR", "OR", null, null);
        assertKeys(latest, "listByLatest");

        // ③ listSummaries（另一条复用同一 record 的查询）
        List<MediaSummary> plain = mediaMapper.listSummaries(2000, 0);
        assertKeys(plain, "listSummaries");

        // ④ listByCollection（收藏夹内）
        List<MediaSummary> coll = mediaMapper.listByCollection(coll1, 200, 0, null, null, null, null, null, null,
                prefix, null, null, "OR", "OR", null, null);
        assertEquals(1, coll.size(), "夹一里只有那一部");
        assertKeys(coll, "listByCollection");
    }

    private void assertKeys(List<MediaSummary> rows, String query) {
        MediaSummary hit = rows.stream().filter(m -> m.id() != null && m.id() == withAll).findFirst().orElse(null);
        assertNotNull(hit, query + " 应能查到刚建的媒体（id=" + withAll + "）");
        assertEquals("SPRING", hit.season(), query + " season 必须来自 external_work.season");
        assertEquals("[\"奇幻\",\"战斗\"]", hit.genresJson(), query + " genresJson 必须是原样 JSON 串");
        assertTrue(hit.collectionIds() != null && hit.collectionIds().equals(coll1 + "," + coll2),
                query + " collectionIds 应为升序逗号串（实际=" + hit.collectionIds() + "）");

        MediaSummary empty = rows.stream().filter(m -> m.id() != null && m.id() == bare).findFirst().orElse(null);
        if (empty != null) {
            assertNull(empty.season(), query + "：无 external_work 时 season 应为 null");
            assertNull(empty.genresJson(), query + "：无 external_work 时 genresJson 应为 null");
            assertNull(empty.collectionIds(), query + "：未入收藏夹时 collectionIds 应为 null");
        }
    }

    private long media(String title) {
        Media m = new Media();
        m.setTitle(title);
        m.setYear(2020);
        m.setStatus("WANT");
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
