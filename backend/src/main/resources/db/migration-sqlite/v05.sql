-- v05: v0.22 metadata library. Preserve legacy Episode ids and Clip episode_id links.
BEGIN;
ALTER TABLE episode RENAME TO episode_v04;
CREATE TABLE episode (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id        INTEGER NOT NULL,
    media_entry_id  INTEGER,
    season          INTEGER,
    episode_no      INTEGER,
    title           TEXT NOT NULL,
    title_override  INTEGER NOT NULL DEFAULT 1,
    note            TEXT,
    url             TEXT,
    video_fp        TEXT,
    cover_path      TEXT,
    created_at      INTEGER,
    UNIQUE (video_fp)
);
INSERT INTO episode (id, media_id, media_entry_id, season, episode_no, title, title_override, note, url, video_fp, cover_path, created_at)
SELECT id, media_id, NULL, season, episode_no, title, 1, note, url, video_fp, cover_path, created_at
FROM episode_v04;
DROP TABLE episode_v04;
CREATE INDEX idx_episode_media ON episode(media_id);
CREATE INDEX idx_episode_media_entry ON episode(media_entry_id);

CREATE TABLE IF NOT EXISTS media_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL DEFAULT 'LEGACY',
    sort_order INTEGER NOT NULL DEFAULT 0,
    title TEXT,
    title_cn TEXT,
    note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (media_id, entry_type, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_media_entry_media ON media_entry(media_id);
INSERT INTO media_entry (media_id, entry_type, sort_order, title, title_cn, created_at, updated_at)
SELECT id, 'LEGACY', 0, title, title, COALESCE(created_at, 0), COALESCE(created_at, 0) FROM media;
UPDATE episode SET media_entry_id = (SELECT me.id FROM media_entry me WHERE me.media_id = episode.media_id AND me.entry_type = 'LEGACY' AND me.sort_order = 0);

CREATE TABLE IF NOT EXISTS external_work (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    media_id INTEGER,
    media_entry_id INTEGER,
    canonical_title TEXT,
    native_title TEXT,
    romaji_title TEXT,
    english_title TEXT,
    aliases_json TEXT,
    description TEXT,
    cover_url TEXT,
    genres_json TEXT,
    format TEXT,
    year INTEGER,
    season TEXT,
    air_date TEXT,
    end_date TEXT,
    episode_count INTEGER,
    relations_json TEXT,
    raw_json TEXT,
    payload_hash TEXT,
    sync_state TEXT NOT NULL DEFAULT 'NEVER_FETCHED',
    last_fetched_at INTEGER,
    last_success_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_external_work_media ON external_work(media_id);
CREATE INDEX IF NOT EXISTS idx_external_work_entry ON external_work(media_entry_id);
CREATE INDEX IF NOT EXISTS idx_external_work_sync ON external_work(sync_state);

CREATE TABLE IF NOT EXISTS external_episode (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_work_id INTEGER NOT NULL,
    provider_episode_id TEXT NOT NULL,
    episode_id INTEGER,
    season INTEGER,
    episode_no INTEGER,
    title TEXT,
    title_cn TEXT,
    description TEXT,
    air_date TEXT,
    duration_sec INTEGER,
    last_seen_at INTEGER,
    sync_state TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (external_work_id, provider_episode_id)
);
CREATE INDEX IF NOT EXISTS idx_external_episode_episode ON external_episode(episode_id);
CREATE INDEX IF NOT EXISTS idx_external_episode_state ON external_episode(sync_state);

CREATE TABLE IF NOT EXISTS external_relation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_work_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    related_external_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    title TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE (external_work_id, provider, related_external_id, relation_type)
);

CREATE TABLE IF NOT EXISTS metadata_sync_task (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    query_json TEXT NOT NULL,
    status TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    processed INTEGER NOT NULL DEFAULT 0,
    added INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (task_id)
);
CREATE INDEX IF NOT EXISTS idx_metadata_sync_task_status ON metadata_sync_task(status);

CREATE TABLE IF NOT EXISTS metadata_sync_candidate (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT,
    title_cn TEXT,
    year INTEGER,
    season TEXT,
    format TEXT,
    cover_url TEXT,
    match_json TEXT,
    decision TEXT NOT NULL DEFAULT 'PENDING',
    target_media_id INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE (task_id, provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_metadata_candidate_task ON metadata_sync_candidate(task_id);
CREATE INDEX IF NOT EXISTS idx_metadata_candidate_decision ON metadata_sync_candidate(decision);
COMMIT;
