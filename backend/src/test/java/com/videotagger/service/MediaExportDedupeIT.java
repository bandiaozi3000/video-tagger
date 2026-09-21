package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.mapper.ExternalRelationMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 导出清单「去重」的**真库**验证（2026-09-21，Flyway 后）：钉死两件事——
 * ① MyBatis 的 `listLinkedPairs`（`<script>` + 两个 `<foreach>` 的 IN 子句）真能跑（否则只有运行时才炸）；
 * ② `MediaService.listExport` 真能把 OVA 的 `seriesBaseId` 指到本体上（用户要的"只留本体"）。
 *
 * 用例照着真实库那组数据造：本体 TV（2005）+ OVA（2007），关系 `番外篇`。
 */
class MediaExportDedupeIT extends AbstractMySqlIT {

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    MediaService mediaService;

    @Autowired
    ExternalRelationMapper relationMapper;

    private long insertMedia(String title, Integer year) {
        jdbc.update("INSERT INTO media (title, year, media_format, status, created_at) "
                + "VALUES (?, ?, 'VIDEO', 'WANT', UNIX_TIMESTAMP() * 1000)", title, year);
        return jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    /** 建 external_work + 一条关联：from 的某条关系指向 relatedExternalId。 */
    private void link(long fromMediaId, String fromExternalId, String relatedExternalId, String relationType) {
        jdbc.update("INSERT INTO external_work (media_id, provider, external_id, created_at, updated_at) "
                + "VALUES (?, 'bangumi', ?, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000)", fromMediaId, fromExternalId);
        Long workId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        jdbc.update("INSERT INTO external_relation (external_work_id, provider, related_external_id, relation_type, title, created_at) "
                + "VALUES (?, 'bangumi', ?, ?, 'IT 关联', UNIX_TIMESTAMP() * 1000)", workId, relatedExternalId, relationType);
    }

    @Test
    void 派生条目指向本体_且关系原样可查() {
        long base = insertMedia("IT 本体 TV", 2005);
        long ova = insertMedia("IT 本体 OVA", 2007);
        // 本体 → OVA 的番外篇；关联用 external_id 反查本地 media
        jdbc.update("INSERT INTO external_work (media_id, provider, external_id, created_at, updated_at) "
                + "VALUES (?, 'bangumi', 'it-ova', UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000)", ova);
        link(base, "it-base", "it-ova", "番外篇");

        List<LinkedPair> pairs = relationMapper.listLinkedPairs(List.of(base, ova));
        assertEquals(1, pairs.size(), "两端都在清单里 → 应查到一条关联");
        assertEquals(base, pairs.get(0).fromMediaId());
        assertEquals(ova, pairs.get(0).toMediaId());
        assertEquals("番外篇", pairs.get(0).relationType());

        List<MediaExportRow> rows = mediaService.listExport(null, null, null, null, null, null, null, null, null,
                List.of(base, ova));
        Map<Long, MediaExportRow> byId = rows.stream().collect(java.util.stream.Collectors.toMap(MediaExportRow::id, row -> row));
        assertEquals(2, rows.size());
        assertNull(byId.get(base).seriesBaseId(), "本体自己 seriesBaseId 为空 → 去重时保留");
        assertEquals(base, byId.get(ova).seriesBaseId(), "OVA 应指向本体 → 去重时被去掉");
    }

    @Test
    void 非视频类关系不算同系列_不归组() {
        long a = insertMedia("IT 视觉小说本体", 2010);
        long b = insertMedia("IT 视觉小说广播剧", 2011);
        jdbc.update("INSERT INTO external_work (media_id, provider, external_id, created_at, updated_at) "
                + "VALUES (?, 'bangumi', 'it-drama', UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000)", b);
        link(a, "it-vn", "it-drama", "广播剧");   // 白名单外

        List<MediaExportRow> rows = mediaService.listExport(null, null, null, null, null, null, null, null, null,
                List.of(a, b));
        for (MediaExportRow row : rows) {
            assertNull(row.seriesBaseId(), "广播剧不是同系列视频 → 不该被折叠");
        }
    }
}
