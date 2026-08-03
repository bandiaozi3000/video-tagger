package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 番剧 ↔ 收藏夹关联（复合主键，经 Mapper 自定义 SQL 操作）。 */
@Data
@TableName("anime_collection")
public class AnimeCollection {
    private Long animeId;
    private Long collectionId;
}
