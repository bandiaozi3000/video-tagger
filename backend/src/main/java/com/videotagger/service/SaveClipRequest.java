package com.videotagger.service;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SaveClipRequest(
        @NotBlank @Size(max = 512) String title,
        @NotBlank @Size(max = 2048)
        @Pattern(regexp = "^(https?://|animeko://|video-asset:).+", message = "url 必须是 http(s) / animeko:// / video-asset: 引用地址") String url,
        @NotNull @DecimalMin("0.0") Double timestampSec,
        @DecimalMin(value = "0.0", inclusive = false) Double endSec,
        /** 标签（词库受控：只能传已存在的词条 id，见 v0.31 标签重做）。编辑时传 null = 不动标签。 */
        @NotEmpty @Size(max = 20) List<Long> tagIds,
        @Size(max = 2000) String note,
        Double videoDuration,
        @Size(max = 2048) String ogImage,
        @Size(max = 300_000) String coverDataUrl,
        @Size(max = 900_000) String detailCoverDataUrl,
        Long mediaId,
        Boolean forceNewMedia,
        Long videoAssetId,
        @Size(max = 256) String sourceRevision,
        Long startMs,
        Long endMs
) {
    public SaveClipRequest {
        if (videoDuration != null && videoDuration < 0) {
            videoDuration = null;
        }
        if (endSec != null && endSec < 0) {
            throw new IllegalArgumentException("结束时间不能为负数");
        }
    }

    public SaveClipRequest(String title, String url, Double timestampSec, List<Long> tagIds, String note,
                           Double videoDuration, String ogImage, String coverDataUrl,
                           String detailCoverDataUrl, Long mediaId, Boolean forceNewMedia) {
        this(title, url, timestampSec, null, tagIds, note, videoDuration, ogImage, coverDataUrl,
                detailCoverDataUrl, mediaId, forceNewMedia, null, null, null, null);
    }

    public SaveClipRequest(String title, String url, Double timestampSec, List<Long> tagIds, String note) {
        this(title, url, timestampSec, null, tagIds, note, null, null, null, null, null, null, null, null, null, null);
    }

    public SaveClipRequest(String title, String url, Double timestampSec, List<Long> tagIds, String note, Double videoDuration) {
        this(title, url, timestampSec, null, tagIds, note, videoDuration, null, null, null, null, null, null, null, null, null);
    }

    public SaveClipRequest(String title, String url, Double timestampSec, Double endSec,
                           List<Long> tagIds, String note, Double videoDuration) {
        this(title, url, timestampSec, endSec, tagIds, note, videoDuration, null, null, null, null, null, null, null, null, null);
    }
}
