-- 站点设置表主键列 `key` 是 MySQL 保留字，改名 skey 摆脱反引号依赖
ALTER TABLE site_setting CHANGE COLUMN `key` skey VARCHAR(100) NOT NULL COMMENT '设置键';
