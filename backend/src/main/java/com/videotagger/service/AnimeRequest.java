package com.videotagger.service;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** 番剧创建/编辑请求。type/status 非法值时由 service 兜底默认（ANIME / WANT）。 */
public record AnimeRequest(
        @NotBlank @Size(max = 512) String title,
        @Size(max = 16) String type,
        @Size(max = 16) String status,
        @DecimalMin("0.0") @DecimalMax("10.0") BigDecimal rating
) {
}
