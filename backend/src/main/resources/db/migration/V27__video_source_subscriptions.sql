CREATE TABLE video_source_subscription (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    display_name VARCHAR(256) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    enabled TINYINT NOT NULL DEFAULT 1,
    refresh_interval_minutes INT NOT NULL DEFAULT 60,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    etag VARCHAR(512),
    last_modified VARCHAR(512),
    last_attempt_at BIGINT,
    last_success_at BIGINT,
    source_count INT NOT NULL DEFAULT 0,
    error_message VARCHAR(2000),
    snapshot_json LONGTEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_source_subscription_url (url(512)),
    KEY idx_video_source_subscription_refresh (enabled, last_attempt_at)
);

CREATE TABLE video_source_definition (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    subscription_id BIGINT,
    import_key VARCHAR(256) NOT NULL,
    factory_id VARCHAR(64) NOT NULL,
    format_version INT NOT NULL,
    name VARCHAR(256) NOT NULL,
    description VARCHAR(1000),
    icon_url VARCHAR(2048),
    config_json LONGTEXT NOT NULL,
    tier INT NOT NULL DEFAULT 2,
    compatibility VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    last_seen_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_source_definition_import (subscription_id, import_key),
    KEY idx_video_source_definition_subscription (subscription_id),
    KEY idx_video_source_definition_status (status, compatibility)
);

CREATE TABLE video_source_instance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    definition_id BIGINT NOT NULL,
    provider_id VARCHAR(128) NOT NULL,
    enabled TINYINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 1000,
    health_state VARCHAR(32) NOT NULL DEFAULT 'UNTESTED',
    health_message VARCHAR(2000),
    last_tested_at BIGINT,
    last_success_at BIGINT,
    failure_count INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uk_video_source_instance_definition (definition_id),
    UNIQUE KEY uk_video_source_instance_provider (provider_id),
    KEY idx_video_source_instance_enabled (enabled, sort_order)
);
