package com.videotagger.service;

/** 标签补全建议：tag 与出现次数 */
public record TagSuggestion(String tag, long count) {
}
