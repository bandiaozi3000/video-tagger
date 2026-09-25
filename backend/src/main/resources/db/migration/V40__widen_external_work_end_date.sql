-- V40：加宽 external_work.end_date（2026-09-25）
--
-- 背景：这一列来自 Bangumi infobox 的「放送结束 / 结束」键，是**自由文本**，
--       不是固定格式日期。实测 media 3619「苍穹的法芙娜 THE BEYOND」返回的是
--           {"结束": [{"v":"2022年3月16日(OVA)"},{"v":"2023年9月20日(TV Edition)"}]}
--       provider 会把数组拼成一个串（≈44 字符），而列宽只有 varchar(32) →
--           Data truncation: Data too long for column 'end_date'
--       → 该条目的 external_work **永远插不进去**，任何同步/关联到它都会失败。
--       这是同步链路的既有缺陷，与对账无关（2026-09-25 媒体库对账时暴露）。
--
-- 回退：ALTER TABLE external_work MODIFY COLUMN end_date VARCHAR(32) NULL;
--       （仅在确认无超长值时可行；超长行会被截断/报错）
--
-- air_date 不动：它来自 Bangumi 的 `date` 字段，固定 YYYY-MM-DD。

ALTER TABLE external_work MODIFY COLUMN end_date VARCHAR(128) NULL;
