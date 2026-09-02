-- v0.22 metadata synchronization workspace: singleton draft and persistent background tasks.
CREATE TABLE metadata_sync_draft (
    id BIGINT PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    query_json TEXT NOT NULL,
    candidates_json LONGTEXT NOT NULL,
    review_json LONGTEXT NOT NULL,
    view_json TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE metadata_sync_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id VARCHAR(64) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    scope_type VARCHAR(32) NOT NULL,
    query_json TEXT NOT NULL,
    status VARCHAR(24) NOT NULL,
    stage VARCHAR(32) NOT NULL,
    total INT NOT NULL DEFAULT 0,
    selected_total INT NOT NULL DEFAULT 0,
    create_count INT NOT NULL DEFAULT 0,
    update_count INT NOT NULL DEFAULT 0,
    link_count INT NOT NULL DEFAULT 0,
    skip_count INT NOT NULL DEFAULT 0,
    processed INT NOT NULL DEFAULT 0,
    succeeded INT NOT NULL DEFAULT 0,
    failed INT NOT NULL DEFAULT 0,
    pending_review INT NOT NULL DEFAULT 0,
    summary_json TEXT,
    error_message VARCHAR(2000),
    created_at BIGINT NOT NULL,
    started_at BIGINT,
    completed_at BIGINT,
    retention_until BIGINT,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_metadata_sync_task_id (task_id),
    KEY idx_metadata_sync_task_status (status),
    KEY idx_metadata_sync_task_created (created_at)
);

CREATE TABLE metadata_sync_task_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    provider VARCHAR(32) NOT NULL,
    external_id VARCHAR(128) NOT NULL,
    title VARCHAR(512),
    title_cn VARCHAR(512),
    action VARCHAR(16) NOT NULL,
    target_media_id BIGINT,
    status VARCHAR(24) NOT NULL,
    stage VARCHAR(32) NOT NULL,
    error_message VARCHAR(2000),
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at BIGINT,
    snapshot_json LONGTEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_metadata_sync_item_external (task_id, provider, external_id),
    KEY idx_metadata_sync_item_task (task_id),
    KEY idx_metadata_sync_item_status (status)
);