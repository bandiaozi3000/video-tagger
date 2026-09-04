-- v0.25 每番降级开关（D7）：allow_hardsub=1 允许该番在无 RAW/软字幕时收硬烧兜底；默认 0=宁缺毋滥
ALTER TABLE media ADD COLUMN allow_hardsub INTEGER NOT NULL DEFAULT 0;
