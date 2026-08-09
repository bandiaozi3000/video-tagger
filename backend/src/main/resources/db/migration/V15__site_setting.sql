-- 站点级设置键值表（key → JSON value），首个用途：背景图轮播配置
CREATE TABLE IF NOT EXISTS site_setting (
    `key` VARCHAR(100) NOT NULL COMMENT '设置键',
    `value` TEXT NULL COMMENT '设置值（JSON）',
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站点设置';
