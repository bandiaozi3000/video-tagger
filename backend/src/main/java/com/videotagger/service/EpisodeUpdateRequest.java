package com.videotagger.service;

import jakarta.validation.constraints.Size;

/** 集信息更新请求（当前仅备注；后续可扩展标题等）。 */
public record EpisodeUpdateRequest(
        @Size(max = 2000) String note
) {
}
