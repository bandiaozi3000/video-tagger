-- v0.22 metadata library: concrete entries, external cache and sync tasks.
CREATE TABLE media_entry (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    media_id BIGINT NOT NULL,
    entry_type VARCHAR(24) NOT NULL DEFAULT 'LEGACY',
    sort_order INT NOT NULL DEFAULT 0,
    title VARCHAR(512),
    title_cn VARCHAR(512),
    note VARCHAR(2000),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    KEY idx_media_entry_media (media_id),
    UNIQUE KEY uk_media_entry_media_type (media_id, entry_type, sort_order)
);
INSERT INTO media_entry (media_id, entry_type, sort_order, title, title_cn, created_at, updated_at)
SELECT id, 'LEGACY', 0, title, title, COALESCE(created_at, 0), COALESCE(created_at, 0) FROM media;

ALTER TABLE episode
    ADD COLUMN media_entry_id BIGINT NULL AFTER media_id,
    ADD COLUMN title_override TINYINT NOT NULL DEFAULT 1 AFTER title,
    MODIFY COLUMN url VARCHAR(2048) NULL,
    MODIFY COLUMN video_fp VARCHAR(64) NULL;
CREATE INDEX idx_episode_media_entry ON episode(media_entry_id);
UPDATE episode e
JOIN media_entry me ON me.media_id = e.media_id AND me.entry_type = 'LEGACY' AND me.sort_order = 0
SET e.media_entry_id = me.id;

CREATE TABLE external_work (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    provider VARCHAR(32) NOT NULL,
    external_id VARCHAR(128) NOT NULL,
    media_id BIGINT NULL,
    media_entry_id BIGINT NULL,
    canonical_title VARCHAR(512),
    native_title VARCHAR(512),
    romaji_title VARCHAR(512),
    english_title VARCHAR(512),
    aliases_json TEXT,
    description TEXT,
    cover_url VARCHAR(2000),
    genres_json TEXT,
    format VARCHAR(32),
    year INT,
    season VARCHAR(16),
    air_date VARCHAR(32),
    end_date VARCHAR(32),
    episode_count INT,
    relations_json TEXT,
    raw_json LONGTEXT,
    payload_hash VARCHAR(128),
    sync_state VARCHAR(24) NOT NULL DEFAULT 'NEVER_FETCHED',
    last_fetched_at BIGINT,
    last_success_at BIGINT,
    last_error VARCHAR(2000),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_external_work_provider_id (provider, external_id),
    KEY idx_external_work_media (media_id),
    KEY idx_external_work_entry (media_entry_id),
    KEY idx_external_work_sync (sync_state)
);

CREATE TABLE external_episode (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    external_work_id BIGINT NOT NULL,
    provider_episode_id VARCHAR(128) NOT NULL,
    episode_id BIGINT NULL,
    season INT,
    episode_no INT,
    title VARCHAR(512),
    title_cn VARCHAR(512),
    description TEXT,
    air_date VARCHAR(32),
    duration_sec INT,
    last_seen_at BIGINT,
    sync_state VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_external_episode_provider_id (external_work_id, provider_episode_id),
    KEY idx_external_episode_episode (episode_id),
    KEY idx_external_episode_state (sync_state)
);

CREATE TABLE external_relation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    external_work_id BIGINT NOT NULL,
    provider VARCHAR(32) NOT NULL,
    related_external_id VARCHAR(128) NOT NULL,
    relation_type VARCHAR(32) NOT NULL,
    title VARCHAR(512),
    created_at BIGINT NOT NULL,
    UNIQUE KEY uk_external_relation (external_work_id, provider, related_external_id, relation_type)
);

CREATE TABLE metadata_sync_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id VARCHAR(64) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    scope_type VARCHAR(32) NOT NULL,
    query_json TEXT NOT NULL,
    status VARCHAR(24) NOT NULL,
    total INT NOT NULL DEFAULT 0,
    processed INT NOT NULL DEFAULT 0,
    added INT NOT NULL DEFAULT 0,
    updated INT NOT NULL DEFAULT 0,
    failed INT NOT NULL DEFAULT 0,
    message VARCHAR(2000),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_metadata_sync_task_id (task_id),
    KEY idx_metadata_sync_task_status (status)
);

CREATE TABLE metadata_sync_candidate (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    provider VARCHAR(32) NOT NULL,
    external_id VARCHAR(128) NOT NULL,
    title VARCHAR(512),
    title_cn VARCHAR(512),
    year INT,
    season VARCHAR(16),
    format VARCHAR(32),
    cover_url VARCHAR(2000),
    match_json TEXT,
    decision VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    target_media_id BIGINT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE KEY uk_metadata_candidate_task_external (task_id, provider, external_id),
    KEY idx_metadata_candidate_task (task_id),
    KEY idx_metadata_candidate_decision (decision)
);
