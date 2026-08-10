-- V18：推荐草稿 + 模板（推荐向导配置快照，JSON 存储）
-- 草稿：单条固定 id=1（自动保存，刷新恢复）；config 含 BGM base64（可达几十 MB）→ LONGTEXT
CREATE TABLE IF NOT EXISTS recommend_draft (
    id         BIGINT PRIMARY KEY,
    config     LONGTEXT NULL COMMENT '推荐配置 JSON（含 BGM base64）',
    updated_at BIGINT NOT NULL COMMENT '最后自动保存时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 模板：多模板可复用（从当前配置另存为命名模板，列表/载入/删除）；config 不含 BGM（通用复用，音乐各自配）
CREATE TABLE IF NOT EXISTS recommend_template (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(64) NOT NULL COMMENT '模板名（如：年度回顾）',
    config     LONGTEXT NULL COMMENT '推荐配置 JSON（不含 BGM）',
    created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
