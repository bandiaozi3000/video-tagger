-- V12：封面 URL 留存（AniList 同步封面补下）
-- 背景：AniList 同步封面走异步下载，进程中断会丢失且无 URL 可重试。
-- cover_url 留存同步来源的封面 URL，供「补下缺失封面」遍历重下。

ALTER TABLE media ADD COLUMN cover_url VARCHAR(512) NULL AFTER original_title;
