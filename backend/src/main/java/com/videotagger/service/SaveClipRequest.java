package com.videotagger.service;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SaveClipRequest(
        @NotBlank String title,
        @NotBlank String url,
        @NotNull @DecimalMin("0.0") Double timestampSec,
        @NotBlank String tag,
        String note
) {
}
