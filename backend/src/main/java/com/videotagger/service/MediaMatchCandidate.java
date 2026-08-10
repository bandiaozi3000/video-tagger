package com.videotagger.service;

/** 打标签候选匹配项：相似媒体 + 相似度分（扩展候选区提示用，用户勾选才归入）。 */
public record MediaMatchCandidate(Long id, String title, Integer year, String subcategory,
                                  Long clipCount, double score) {
}
