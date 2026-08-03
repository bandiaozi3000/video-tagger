package com.videotagger.service;

/** 打标三维度：番剧 / 集 / 片段。三层共享同一 Milvus collection 与 embedding 任务表。 */
public enum EntityType {
    ANIME, EPISODE, CLIP
}
