-- V5：收藏夹（多对多）。分类体系中的自定义清单维度，仅作筛选器。
CREATE TABLE IF NOT EXISTS collection (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(64) NOT NULL,
    created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anime_collection (
    anime_id      BIGINT NOT NULL,
    collection_id BIGINT NOT NULL,
    PRIMARY KEY (anime_id, collection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
