-- v08: v0.23 remote video sources, unified assets, tasks and Clip source binding.
CREATE TABLE IF NOT EXISTS video_source_package (
    id INTEGER PRIMARY KEY AUTOINCREMENT, media_entry_id INTEGER NOT NULL, provider TEXT NOT NULL,
    provider_package_id TEXT NOT NULL, revision TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'CANDIDATE',
    title TEXT, release_group TEXT, year INTEGER, season TEXT, media_format TEXT, episode_count INTEGER,
    subtitle_languages_json TEXT, audio_languages_json TEXT, quality TEXT, video_codec TEXT, container TEXT,
    capabilities_json TEXT, source_page_url TEXT, sanitized_snapshot_json TEXT, match_reason_json TEXT,
    adopted_at INTEGER, last_refreshed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE (provider, provider_package_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_video_source_package_entry ON video_source_package(media_entry_id);
CREATE INDEX IF NOT EXISTS idx_video_source_package_stable ON video_source_package(provider, provider_package_id);
CREATE INDEX IF NOT EXISTS idx_video_source_package_status ON video_source_package(status);

CREATE TABLE IF NOT EXISTS video_source_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT, package_id INTEGER NOT NULL, provider_item_id TEXT NOT NULL,
    revision TEXT NOT NULL, item_kind TEXT NOT NULL DEFAULT 'UNKNOWN', episode_no INTEGER, episode_end_no INTEGER,
    title TEXT, duration_ms INTEGER, subtitle_languages_json TEXT, audio_languages_json TEXT, quality TEXT,
    capabilities_json TEXT, source_page_url TEXT, sanitized_snapshot_json TEXT, status TEXT NOT NULL DEFAULT 'PENDING',
    last_seen_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE (package_id, provider_item_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_video_source_item_package ON video_source_item(package_id);
CREATE INDEX IF NOT EXISTS idx_video_source_item_episode_no ON video_source_item(package_id, episode_no);
CREATE INDEX IF NOT EXISTS idx_video_source_item_status ON video_source_item(status);

CREATE TABLE IF NOT EXISTS video_source_episode_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source_item_id INTEGER NOT NULL, episode_id INTEGER,
    mapping_reason TEXT NOT NULL, confidence REAL, status TEXT NOT NULL DEFAULT 'PENDING',
    manual_confirmed INTEGER NOT NULL DEFAULT 0, conflict_code TEXT, conflict_message TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (source_item_id)
);
CREATE INDEX IF NOT EXISTS idx_video_source_episode_target ON video_source_episode_map(episode_id);
CREATE INDEX IF NOT EXISTS idx_video_source_episode_status ON video_source_episode_map(status);

CREATE TABLE IF NOT EXISTS video_source_resolution_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source_item_id INTEGER NOT NULL, revision TEXT NOT NULL,
    purpose TEXT NOT NULL, selection_key TEXT NOT NULL DEFAULT 'DEFAULT', resolved_locator TEXT NOT NULL,
    mime_type TEXT, content_length INTEGER, range_supported INTEGER NOT NULL DEFAULT 0,
    probe_state TEXT NOT NULL DEFAULT 'UNCHECKED', probe_message TEXT, retryable INTEGER NOT NULL DEFAULT 1,
    resolved_at INTEGER NOT NULL, expires_at INTEGER, checked_at INTEGER, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, UNIQUE (source_item_id, revision, purpose, selection_key)
);
CREATE INDEX IF NOT EXISTS idx_video_source_resolution_expiry ON video_source_resolution_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_video_source_resolution_state ON video_source_resolution_cache(probe_state);

CREATE TABLE IF NOT EXISTS video_asset (
    id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id INTEGER NOT NULL, source_item_id INTEGER,
    asset_type TEXT NOT NULL, asset_role TEXT NOT NULL DEFAULT 'UNASSIGNED', priority INTEGER NOT NULL DEFAULT 0,
    availability_state TEXT NOT NULL DEFAULT 'UNCHECKED', source_revision TEXT, display_name TEXT,
    stable_locator TEXT, source_page_url TEXT, storage_path TEXT, mime_type TEXT, duration_ms INTEGER,
    container TEXT, video_codec TEXT, audio_codec TEXT, width INTEGER, height INTEGER, file_size INTEGER,
    fingerprint TEXT, failure_reason TEXT, last_verified_at INTEGER, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_asset_episode ON video_asset(episode_id);
CREATE INDEX IF NOT EXISTS idx_video_asset_source_item ON video_asset(source_item_id);
CREATE INDEX IF NOT EXISTS idx_video_asset_role ON video_asset(episode_id, asset_role, priority);
CREATE INDEX IF NOT EXISTS idx_video_asset_state ON video_asset(availability_state);
CREATE INDEX IF NOT EXISTS idx_video_asset_fingerprint ON video_asset(fingerprint);

CREATE TABLE IF NOT EXISTS video_asset_track (
    id INTEGER PRIMARY KEY AUTOINCREMENT, video_asset_id INTEGER NOT NULL, track_type TEXT NOT NULL,
    track_index INTEGER NOT NULL, language TEXT, title TEXT, format TEXT, codec TEXT,
    default_track INTEGER NOT NULL DEFAULT 0, forced_track INTEGER NOT NULL DEFAULT 0,
    external_locator TEXT, storage_path TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE (video_asset_id, track_type, track_index)
);
CREATE INDEX IF NOT EXISTS idx_video_asset_track_asset ON video_asset_track(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_asset_track_language ON video_asset_track(track_type, language);

CREATE TABLE IF NOT EXISTS video_time_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT, old_asset_id INTEGER NOT NULL, new_asset_id INTEGER NOT NULL,
    parent_mapping_id INTEGER, status TEXT NOT NULL DEFAULT 'UNMAPPED', offset_ms INTEGER, drift_ratio REAL,
    confidence REAL, notes TEXT, created_at INTEGER NOT NULL, confirmed_at INTEGER, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_time_mapping_old ON video_time_mapping(old_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_time_mapping_new ON video_time_mapping(new_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_time_mapping_status ON video_time_mapping(status);

CREATE TABLE IF NOT EXISTS video_time_mapping_anchor (
    id INTEGER PRIMARY KEY AUTOINCREMENT, time_mapping_id INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
    old_time_ms INTEGER NOT NULL, new_time_ms INTEGER NOT NULL, confidence REAL, created_at INTEGER NOT NULL,
    UNIQUE (time_mapping_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_video_time_mapping_anchor_mapping ON video_time_mapping_anchor(time_mapping_id);

CREATE TABLE IF NOT EXISTS video_source_task (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, task_type TEXT NOT NULL, provider TEXT,
    status TEXT NOT NULL DEFAULT 'QUEUED', package_id INTEGER, video_asset_id INTEGER, clip_id INTEGER,
    total INTEGER NOT NULL DEFAULT 0, processed INTEGER NOT NULL DEFAULT 0, succeeded INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0, bytes_total INTEGER, bytes_processed INTEGER NOT NULL DEFAULT 0,
    plan_json TEXT, message TEXT, created_at INTEGER NOT NULL, started_at INTEGER, completed_at INTEGER,
    updated_at INTEGER NOT NULL, UNIQUE (task_id)
);
CREATE INDEX IF NOT EXISTS idx_video_source_task_status ON video_source_task(status);
CREATE INDEX IF NOT EXISTS idx_video_source_task_created ON video_source_task(created_at);

CREATE TABLE IF NOT EXISTS video_source_task_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, item_key TEXT NOT NULL,
    task_type TEXT NOT NULL, provider TEXT, status TEXT NOT NULL DEFAULT 'QUEUED', source_item_id INTEGER,
    video_asset_id INTEGER, clip_id INTEGER, bytes_total INTEGER, bytes_processed INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0, temp_path TEXT, resume_json TEXT, error_code TEXT, error_message TEXT,
    last_attempt_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (task_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_video_source_task_item_task ON video_source_task_item(task_id);
CREATE INDEX IF NOT EXISTS idx_video_source_task_item_status ON video_source_task_item(status);
CREATE INDEX IF NOT EXISTS idx_video_source_task_item_asset ON video_source_task_item(video_asset_id);

CREATE TABLE IF NOT EXISTS clips (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, timestamp_sec REAL NOT NULL,
    end_sec REAL, tag TEXT NOT NULL, note TEXT, created_at INTEGER NOT NULL, episode_id INTEGER, video_fp TEXT,
    video_duration REAL, cover_path TEXT, detail_cover_path TEXT
);
ALTER TABLE clips ADD COLUMN video_asset_id INTEGER;
ALTER TABLE clips ADD COLUMN start_ms INTEGER;
ALTER TABLE clips ADD COLUMN end_ms INTEGER;
ALTER TABLE clips ADD COLUMN source_revision TEXT;
ALTER TABLE clips ADD COLUMN time_mapping_id INTEGER;
ALTER TABLE clips ADD COLUMN material_state TEXT NOT NULL DEFAULT 'REFERENCE_ONLY';
UPDATE clips SET start_ms = CAST(ROUND(timestamp_sec * 1000) AS INTEGER) WHERE start_ms IS NULL AND timestamp_sec IS NOT NULL;
UPDATE clips SET end_ms = CAST(ROUND(end_sec * 1000) AS INTEGER) WHERE end_ms IS NULL AND end_sec IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clips_video_asset ON clips(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_clips_time_mapping ON clips(time_mapping_id);
CREATE INDEX IF NOT EXISTS idx_clips_material_state ON clips(material_state);
