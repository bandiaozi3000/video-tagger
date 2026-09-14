-- 回收站媒体不再占用 Bangumi 稳定关联；清除历史残留的外部资料与桥接缓存。
DELETE er FROM external_relation er
JOIN external_work ew ON ew.id = er.external_work_id
JOIN media m ON m.id = ew.media_id
WHERE m.deleted_at IS NOT NULL;

DELETE ee FROM external_episode ee
JOIN external_work ew ON ew.id = ee.external_work_id
JOIN media m ON m.id = ew.media_id
WHERE m.deleted_at IS NOT NULL;

DELETE ew FROM external_work ew
JOIN media m ON m.id = ew.media_id
WHERE m.deleted_at IS NOT NULL;
