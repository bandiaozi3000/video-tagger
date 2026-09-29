-- V42：封面工坊「常用模板」（2026-09-29）
--
-- 只存用户自己攒的**参数组合**（版式 + 文字/位置/处理），**不存具体片段** —— 每次用时重新勾。
-- 内置 21 套版式写死在代码里（`editor/cover/cover-model.ts` 的 LAYOUTS），**不入库**，
-- 与「推荐等级四档写死、不做配置」同款决策。
--
-- 与 recommend_template 是**兄弟表**（同形：name + config JSON + 时间戳），但没有合并：
-- 那边的 config 是推荐视频渲染参数，这边是封面参数，语义不同、生命周期不同。
--
-- 生成的封面**不入库**（只有文件）：成品落在 covers/make/，参数随推荐草稿保存（EditorConfig.cover），
-- 所以「回到上次的封面设置」靠草稿回填，不需要再去查产物行。

CREATE TABLE cover_template (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    name       VARCHAR(80)  NOT NULL,
    -- 封面参数 JSON（CoverConfig：版式 / 文字 / 位置 / 处理）
    config     TEXT         NOT NULL,
    created_at BIGINT       NOT NULL,
    updated_at BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
