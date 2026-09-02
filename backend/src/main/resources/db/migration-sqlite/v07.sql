-- v07: metadata synchronization workspace with one draft and persistent task items.
CREATE TABLE IF NOT EXISTS metadata_sync_draft (
    id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL,
    query_json TEXT NOT NULL,
    candidates_json TEXT NOT NULL,
    review_json TEXT NOT NULL,
    view_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS metadata_sync_task (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    query_json TEXT NOT NULL,
    status TEXT NOT NULL,
    stage TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    selected_total INTEGER NOT NULL DEFAULT 0,
    create_count INTEGER NOT NULL DEFAULT 0,
    update_count INTEGER NOT NULL DEFAULT 0,
    link_count INTEGER NOT NULL DEFAULT 0,
    skip_count INTEGER NOT NULL DEFAULT 0,
    processed INTEGER NOT NULL DEFAULT 0,
    succeeded INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    pending_review INTEGER NOT NULL DEFAULT 0,
    summary_json TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    retention_until INTEGER,
    updated_at INTEGER NOT NULL,
    UNIQUE (task_id)
);
CREATE INDEX IF NOT EXISTS idx_metadata_sync_task_status ON metadata_sync_task(status);
CREATE INDEX IF NOT EXISTS idx_metadata_sync_task_created ON metadata_sync_task(created_at);

CREATE TABLE IF NOT EXISTS metadata_sync_task_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT,
    title_cn TEXT,
    action TEXT NOT NULL,
    target_media_id INTEGER,
    status TEXT NOT NULL,
    stage TEXT NOT NULL,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    snapshot_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (task_id, provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_metadata_sync_item_task ON metadata_sync_task_item(task_id);
CREATE INDEX IF NOT EXISTS idx_metadata_sync_item_status ON metadata_sync_task_item(status);