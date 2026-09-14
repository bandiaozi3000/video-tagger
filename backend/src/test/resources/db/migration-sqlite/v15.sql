-- 回收站媒体不再占用 Bangumi 稳定关联；清除历史残留的外部资料与桥接缓存。
DELETE FROM external_relation
WHERE external_work_id IN (
    SELECT ew.id
    FROM external_work ew
    JOIN media m ON m.id = ew.media_id
    WHERE m.deleted_at IS NOT NULL
);

DELETE FROM external_episode
WHERE external_work_id IN (
    SELECT ew.id
    FROM external_work ew
    JOIN media m ON m.id = ew.media_id
    WHERE m.deleted_at IS NOT NULL
);

DELETE FROM external_work
WHERE media_id IN (
    SELECT id FROM media WHERE deleted_at IS NOT NULL
);
