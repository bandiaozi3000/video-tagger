CREATE TABLE IF NOT EXISTS highlight_project (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    config_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (media_id)
);
CREATE INDEX IF NOT EXISTS idx_highlight_project_updated ON highlight_project(updated_at);

CREATE TABLE IF NOT EXISTS highlight_project_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    clip_id INTEGER,
    sort_order INTEGER NOT NULL,
    in_sec REAL,
    out_sec REAL,
    spoiler_state TEXT NOT NULL DEFAULT 'PENDING',
    caption TEXT,
    source_type TEXT NOT NULL DEFAULT 'LOCAL_LIBRARY',
    source_state TEXT NOT NULL DEFAULT 'PENDING',
    source_path TEXT,
    source_url TEXT,
    source_message TEXT,
    original_volume INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_highlight_item_project_sort ON highlight_project_item(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_highlight_item_clip ON highlight_project_item(clip_id);

CREATE TABLE IF NOT EXISTS highlight_export (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    mode TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    output_path TEXT,
    status TEXT NOT NULL,
    message TEXT,
    created_at INTEGER NOT NULL,
    finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_highlight_export_project_created ON highlight_export(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_highlight_export_status ON highlight_export(status);
