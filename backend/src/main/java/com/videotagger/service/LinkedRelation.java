package com.videotagger.service;

/**
 * 「关联条目 ↔ 本地媒体」的联表结果行（外借片段的来源解析用）。
 *
 * 独立的 record：`ExternalRelation` 是表实体，不该塞本地媒体的伪列。
 */
public record LinkedRelation(String relationType, String title, Long linkedMediaId,
                             Integer linkedMediaYear, Long linkedClipCount) {
}
