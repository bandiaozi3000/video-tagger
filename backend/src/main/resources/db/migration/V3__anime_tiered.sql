-- V3：番剧三层结构（anime → episode → clip）+ 标签词库与三层关联
-- 过渡策略：clips 保留 title/url/tag 列以兼容现有搜索/时间线/统计，仅新增 episode_id 关联；
-- 标签新体系走 tag 词库 + 关联表，Phase 2 搜索升级后再废弃 clips.tag。

CREATE TABLE IF NOT EXISTS anime (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    title      VARCHAR(512) NOT NULL,
    aliases    TEXT,
    type       VARCHAR(16) NOT NULL DEFAULT 'ANIME',
    status     VARCHAR(16) NOT NULL DEFAULT 'WANT',
    rating     DECIMAL(2,1) NULL,
    cover_path VARCHAR(512) NULL,
    confirmed  TINYINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS episode (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    anime_id   BIGINT NOT NULL,
    season     INT NULL,
    episode_no INT NULL,
    title      VARCHAR(512) NOT NULL,
    url        VARCHAR(2048) NOT NULL,
    video_fp   VARCHAR(64) NOT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE KEY uk_episode_video_fp (video_fp),
    KEY idx_episode_anime (anime_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE clips
    ADD COLUMN episode_id BIGINT NULL AFTER url,
    ADD KEY idx_clips_episode (episode_id);

CREATE TABLE IF NOT EXISTS tag (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE KEY uk_tag_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anime_tag (
    anime_id BIGINT NOT NULL,
    tag_id   BIGINT NOT NULL,
    PRIMARY KEY (anime_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS episode_tag (
    episode_id BIGINT NOT NULL,
    tag_id     BIGINT NOT NULL,
    PRIMARY KEY (episode_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clip_tag (
    clip_id BIGINT NOT NULL,
    tag_id  BIGINT NOT NULL,
    PRIMARY KEY (clip_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
