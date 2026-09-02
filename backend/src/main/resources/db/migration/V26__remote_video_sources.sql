-- v0.23 remote video sources, unified assets, persistent tasks and Clip source binding.
CREATE TABLE video_source_package (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    media_entry_id BIGINT NOT NULL,
    provider VARCHAR(64) NOT NULL,
    provider_package_id VARCHAR(256) NOT NULL,
    revision VARCHAR(256) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'CANDIDATE',
    title VARCHAR(512),
    release_group VARCHAR(256),
    year INT,
    season VARCHAR(32),
    media_format VARCHAR(32),
    episode_count INT,
    subtitle_languages_json TEXT,
    audio_languages_json TEXT,
    quality VARCHAR(128),
    video_codec VARCHAR(128),
    container VARCHAR(64),
    capabilities_json TEXT,
    source_page_url VARCHAR(2048),
    sanitized_snapshot_json LONGTEXT,
    match_reason_json TEXT,
    adopted_at BIGINT,
    last_refreshed_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_source_package_revision (provider, provider_package_id, revision),
    KEY idx_video_source_package_entry (media_entry_id),
    KEY idx_video_source_package_stable (provider, provider_package_id),
    KEY idx_video_source_package_status (status)
);

CREATE TABLE video_source_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    package_id BIGINT NOT NULL,
    provider_item_id VARCHAR(256) NOT NULL,
    revision VARCHAR(256) NOT NULL,
    item_kind VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
    episode_no INT,
    episode_end_no INT,
    title VARCHAR(512),
    duration_ms BIGINT,
    subtitle_languages_json TEXT,
    audio_languages_json TEXT,
    quality VARCHAR(128),
    capabilities_json TEXT,
    source_page_url VARCHAR(2048),
    sanitized_snapshot_json LONGTEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    last_seen_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_source_item_revision (package_id, provider_item_id, revision),
    KEY idx_video_source_item_package (package_id),
    KEY idx_video_source_item_episode_no (package_id, episode_no),
    KEY idx_video_source_item_status (status)
);

CREATE TABLE video_source_episode_map (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_item_id BIGINT NOT NULL,
    episode_id BIGINT,
    mapping_reason VARCHAR(32) NOT NULL,
    confidence DECIMAL(6,5),
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    manual_confirmed TINYINT NOT NULL DEFAULT 0,
    conflict_code VARCHAR(64),
    conflict_message VARCHAR(2000),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_source_episode_item (source_item_id),
    KEY idx_video_source_episode_target (episode_id),
    KEY idx_video_source_episode_status (status)
);

CREATE TABLE video_source_resolution_cache (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_item_id BIGINT NOT NULL,
    revision VARCHAR(256) NOT NULL,
    purpose VARCHAR(24) NOT NULL,
    selection_key VARCHAR(256) NOT NULL DEFAULT 'DEFAULT',
    resolved_locator TEXT NOT NULL,
    mime_type VARCHAR(256),
    content_length BIGINT,
    range_supported TINYINT NOT NULL DEFAULT 0,
    probe_state VARCHAR(32) NOT NULL DEFAULT 'UNCHECKED',
    probe_message VARCHAR(2000),
    retryable TINYINT NOT NULL DEFAULT 1,
    resolved_at BIGINT NOT NULL,
    expires_at BIGINT,
    checked_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_source_resolution (source_item_id, revision, purpose, selection_key),
    KEY idx_video_source_resolution_expiry (expires_at),
    KEY idx_video_source_resolution_state (probe_state)
);

CREATE TABLE video_asset (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    episode_id BIGINT NOT NULL,
    source_item_id BIGINT,
    asset_type VARCHAR(32) NOT NULL,
    asset_role VARCHAR(24) NOT NULL DEFAULT 'UNASSIGNED',
    priority INT NOT NULL DEFAULT 0,
    availability_state VARCHAR(32) NOT NULL DEFAULT 'UNCHECKED',
    source_revision VARCHAR(256),
    display_name VARCHAR(512),
    stable_locator TEXT,
    source_page_url VARCHAR(2048),
    storage_path VARCHAR(2048),
    mime_type VARCHAR(256),
    duration_ms BIGINT,
    container VARCHAR(64),
    video_codec VARCHAR(128),
    audio_codec VARCHAR(128),
    width INT,
    height INT,
    file_size BIGINT,
    fingerprint VARCHAR(256),
    failure_reason VARCHAR(2000),
    last_verified_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    KEY idx_video_asset_episode (episode_id),
    KEY idx_video_asset_source_item (source_item_id),
    KEY idx_video_asset_role (episode_id, asset_role, priority),
    KEY idx_video_asset_state (availability_state),
    KEY idx_video_asset_fingerprint (fingerprint)
);

CREATE TABLE video_asset_track (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    video_asset_id BIGINT NOT NULL,
    track_type VARCHAR(24) NOT NULL,
    track_index INT NOT NULL,
    language VARCHAR(64),
    title VARCHAR(512),
    format VARCHAR(128),
    codec VARCHAR(128),
    default_track TINYINT NOT NULL DEFAULT 0,
    forced_track TINYINT NOT NULL DEFAULT 0,
    external_locator TEXT,
    storage_path VARCHAR(2048),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_asset_track_index (video_asset_id, track_type, track_index),
    KEY idx_video_asset_track_asset (video_asset_id),
    KEY idx_video_asset_track_language (track_type, language)
);

CREATE TABLE video_time_mapping (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    old_asset_id BIGINT NOT NULL,
    new_asset_id BIGINT NOT NULL,
    parent_mapping_id BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',
    offset_ms BIGINT,
    drift_ratio DOUBLE,
    confidence DECIMAL(6,5),
    notes VARCHAR(2000),
    created_at BIGINT NOT NULL,
    confirmed_at BIGINT,
    updated_at BIGINT NOT NULL,
    KEY idx_video_time_mapping_old (old_asset_id),
    KEY idx_video_time_mapping_new (new_asset_id),
    KEY idx_video_time_mapping_status (status)
);

CREATE TABLE video_time_mapping_anchor (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    time_mapping_id BIGINT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    old_time_ms BIGINT NOT NULL,
    new_time_ms BIGINT NOT NULL,
    confidence DECIMAL(6,5),
    created_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_time_mapping_anchor_order (time_mapping_id, sort_order),
    KEY idx_video_time_mapping_anchor_mapping (time_mapping_id)
);

CREATE TABLE video_source_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id VARCHAR(64) NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    provider VARCHAR(64),
    status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
    package_id BIGINT,
    video_asset_id BIGINT,
    clip_id BIGINT,
    total INT NOT NULL DEFAULT 0,
    processed INT NOT NULL DEFAULT 0,
    succeeded INT NOT NULL DEFAULT 0,
    failed INT NOT NULL DEFAULT 0,
    bytes_total BIGINT,
    bytes_processed BIGINT NOT NULL DEFAULT 0,
    plan_json LONGTEXT,
    message VARCHAR(2000),
    created_at BIGINT NOT NULL,
    started_at BIGINT,
    completed_at BIGINT,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_source_task_id (task_id),
    KEY idx_video_source_task_status (status),
    KEY idx_video_source_task_created (created_at)
);

CREATE TABLE video_source_task_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    item_key VARCHAR(256) NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    provider VARCHAR(64),
    status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
    source_item_id BIGINT,
    video_asset_id BIGINT,
    clip_id BIGINT,
    bytes_total BIGINT,
    bytes_processed BIGINT NOT NULL DEFAULT 0,
    attempts INT NOT NULL DEFAULT 0,
    temp_path VARCHAR(2048),
    resume_json LONGTEXT,
    error_code VARCHAR(64),
    error_message VARCHAR(2000),
    last_attempt_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_source_task_item_key (task_id, item_key),
    KEY idx_video_source_task_item_task (task_id),
    KEY idx_video_source_task_item_status (status),
    KEY idx_video_source_task_item_asset (video_asset_id)
);

ALTER TABLE clips
    ADD COLUMN video_asset_id BIGINT NULL AFTER episode_id,
    ADD COLUMN start_ms BIGINT NULL AFTER timestamp_sec,
    ADD COLUMN end_ms BIGINT NULL AFTER end_sec,
    ADD COLUMN source_revision VARCHAR(256) NULL AFTER video_asset_id,
    ADD COLUMN time_mapping_id BIGINT NULL AFTER source_revision,
    ADD COLUMN material_state VARCHAR(32) NOT NULL DEFAULT 'REFERENCE_ONLY' AFTER time_mapping_id;

UPDATE clips SET start_ms = ROUND(timestamp_sec * 1000) WHERE start_ms IS NULL AND timestamp_sec IS NOT NULL;
UPDATE clips SET end_ms = ROUND(end_sec * 1000) WHERE end_ms IS NULL AND end_sec IS NOT NULL;
CREATE INDEX idx_clips_video_asset ON clips(video_asset_id);
CREATE INDEX idx_clips_time_mapping ON clips(time_mapping_id);
CREATE INDEX idx_clips_material_state ON clips(material_state);
