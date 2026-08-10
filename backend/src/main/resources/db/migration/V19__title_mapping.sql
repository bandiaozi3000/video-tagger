-- V19：标题映射（识别标题 → 媒体 id，打标签自动归位）
-- 打标签解析出的标题 A 与库里标题不同时，用户可手动映射 A→B；映射后下次同标题自动归入 B。
CREATE TABLE IF NOT EXISTS title_mapping (
    title      VARCHAR(512) NOT NULL COMMENT '识别标题（TitleParser 解析出的番剧名）',
    media_id   BIGINT NOT NULL COMMENT '映射到的媒体 id',
    created_at BIGINT NOT NULL,
    PRIMARY KEY (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
