-- V34：推荐草稿 / 模板升级为「配置 + 候选筛选 + 变体」（v0.28 §7.2）
-- 旧 JSON 结构不兼容 → 直接重建两表并清旧数据（用户 2026-09-18 明确接受清数据，不写兼容读取分支）。
DROP TABLE IF EXISTS recommend_draft;
DROP TABLE IF EXISTS recommend_template;

-- 草稿：单条固定 id=1（自动保存，刷新恢复）；config 含 BGM base64（可达几十 MB）→ LONGTEXT
CREATE TABLE recommend_draft (
    id         BIGINT PRIMARY KEY,
    config     LONGTEXT NULL COMMENT '编辑会话暂存 JSON（version=2：{config, filter, variants}）',
    updated_at BIGINT NOT NULL COMMENT '最后自动保存时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 模板：多模板可复用（配置 + 候选筛选条件 + 变体定义）；不含 BGM（体积大，音乐各自配）
CREATE TABLE recommend_template (
    id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(64) NOT NULL COMMENT '模板名（如：年度回顾）',
    config     LONGTEXT NULL COMMENT '模板 JSON（version=2：{config, filter, variants}，无 BGM）',
    created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
