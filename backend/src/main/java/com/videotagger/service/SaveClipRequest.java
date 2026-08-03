package com.videotagger.service;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SaveClipRequest(
        @NotBlank @Size(max = 512) String title,
        @NotBlank @Size(max = 2048)
        @Pattern(regexp = "^https?://.+", message = "url 必须是 http(s) 地址") String url,
        @NotNull @DecimalMin("0.0") Double timestampSec,
        @NotBlank @Size(max = 100) String tag,
        @Size(max = 2000) String note,
        Double videoDuration,
        @Size(max = 2048) String ogImage,
        @Size(max = 300_000) String coverDataUrl,
        @Size(max = 900_000) String detailCoverDataUrl
) {
    public SaveClipRequest {
        if (videoDuration != null && videoDuration < 0) {
            videoDuration = null;
        }
    }

    public SaveClipRequest(String title, String url, Double timestampSec, String tag, String note) {
        this(title, url, timestampSec, tag, note, null, null, null, null);
    }

    public SaveClipRequest(String title, String url, Double timestampSec, String tag, String note, Double videoDuration) {
        this(title, url, timestampSec, tag, note, videoDuration, null, null, null);
    }
}
