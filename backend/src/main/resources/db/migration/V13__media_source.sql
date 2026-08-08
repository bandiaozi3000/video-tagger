-- V13：媒体来源（手动 / AniList / omofuna 细分），为后续按来源筛选/治理打底
-- 存储值：MANUAL（手动新建/打标自动归组）/ ANILIST（AniList 同步）/ OMOFUNA（omofuna 同步）
ALTER TABLE media ADD COLUMN source VARCHAR(32) NULL AFTER cover_url;

-- 启发式回填：AniList 同步必填 original_title（日文原名）；omofuna 封面域名 as.cfhls.top；
-- 其余手动。顺序保证 ANILIST 优先（AniList 记录即使封面被 omofuna 补下过，original_title 仍非空）。
UPDATE media SET source = 'ANILIST' WHERE original_title IS NOT NULL AND original_title != '';
UPDATE media SET source = 'OMOFUNA' WHERE source IS NULL AND cover_url LIKE '%cfhls.top%';
UPDATE media SET source = 'MANUAL' WHERE source IS NULL;
