CREATE TABLE highlight_project (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    media_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    config_json LONGTEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_highlight_project_media (media_id),
    KEY idx_highlight_project_updated (updated_at)
);

CREATE TABLE highlight_project_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    clip_id BIGINT NULL,
    sort_order INT NOT NULL,
    in_sec DOUBLE NULL,
    out_sec DOUBLE NULL,
    spoiler_state VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    caption VARCHAR(200),
    source_type VARCHAR(24) NOT NULL DEFAULT 'LOCAL_LIBRARY',
    source_state VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    source_path VARCHAR(500),
    source_url VARCHAR(2000),
    source_message VARCHAR(500),
    original_volume INT NOT NULL DEFAULT 100,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    KEY idx_highlight_item_project_sort (project_id, sort_order),
    KEY idx_highlight_item_clip (clip_id)
);

CREATE TABLE highlight_export (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    mode VARCHAR(16) NOT NULL,
    snapshot_json LONGTEXT NOT NULL,
    output_path VARCHAR(500),
    status VARCHAR(16) NOT NULL,
    message VARCHAR(1000),
    created_at BIGINT NOT NULL,
    finished_at BIGINT NULL,
    KEY idx_highlight_export_project_created (project_id, created_at),
    KEY idx_highlight_export_status (status)
);
