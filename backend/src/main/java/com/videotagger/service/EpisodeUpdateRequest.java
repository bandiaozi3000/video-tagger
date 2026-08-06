package com.videotagger.service;

import jakarta.validation.constraints.Size;

/** 集信息更新请求（备注 + 季/集号）。字段传 null 表示不改；note 传空串表示清空。 */
public record EpisodeUpdateRequest(
        @Size(max = 2000) String note,
        Integer season,
        Integer episodeNo
) {
}
