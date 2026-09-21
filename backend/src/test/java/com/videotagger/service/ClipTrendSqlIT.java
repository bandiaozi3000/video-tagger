package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.mapper.ClipMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 统计页趋势查询在 **真 MySQL** 上必须能跑（2026-09-21）。
 *
 * 背景：`ClipMapper.countTrend` 原来只写了 SQLite 方言 `date(x, 'unixepoch')`，
 * 在 mysql profile 下直接语法报错（用户报的就是这条）—— 加 MySQL 方言分支后补这条 IT 钉住。
 * 无外键约束，所以直接插 clips 行即可。
 */
class ClipTrendSqlIT extends AbstractMySqlIT {

    @Autowired
    ClipMapper clipMapper;

    @Autowired
    JdbcTemplate jdbc;

    private void insertClip(long createdAtMs) {
        // 用 tag 做标记：Testcontainers 的 MySQL 在同一轮测试里被多个 IT 共享，
        // 其它 IT 也会插 clips（第一版断言全表计数就被别人的 19 条搞挂过），所以只认自己的行。
        jdbc.update("INSERT INTO clips (title, url, material_state, timestamp_sec, tag, created_at) "
                + "VALUES ('IT 片段', 'file:///x.mp4', 'NONE', 0, 'IT-TREND', ?)", createdAtMs);
    }

    @Test
    void 趋势查询按天分组_在MySQL上不报语法错() {
        ZoneId zone = ZoneId.systemDefault();
        long today = Instant.now().toEpochMilli();
        long yesterday = LocalDate.now(zone).minusDays(1).atStartOfDay(zone).toInstant().toEpochMilli();
        insertClip(today);
        insertClip(today);
        insertClip(yesterday);

        List<?> points = clipMapper.countTrend(Instant.now().minus(7, java.time.temporal.ChronoUnit.DAYS).toEpochMilli());
        assertTrue(points.size() >= 1, "至少应有今天一条趋势点（方言分支没选错就不会报语法错）");

        String todayText = LocalDate.now(zone).toString();
        Integer todayCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clips WHERE tag = 'IT-TREND' AND DATE(FROM_UNIXTIME(created_at / 1000)) = ?",
                Integer.class, todayText);
        assertEquals(2, todayCount, "自己的 2 条（毫秒时间戳 /1000 后）应归到今天");
        String firstDate = jdbc.queryForObject(
                "SELECT DATE(FROM_UNIXTIME(created_at / 1000)) FROM clips WHERE tag = 'IT-TREND' "
                        + "ORDER BY created_at DESC LIMIT 1",
                String.class);
        assertEquals(todayText, firstDate, "毫秒时间戳按 /1000 换算后应落回今天");
    }
}
