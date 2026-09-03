package com.videotagger.service;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** 媒体创建/编辑请求。mediaFormat/subcategory/status 非法值时由 service 兜底默认。
 *  子分类优先按 subcategoryId（树节点 id）引用；旧客户端只传名字时按 subcategory 名字回退解析。 */
public record MediaRequest(
        @NotBlank @Size(max = 512) String title,
        Integer year,
        Integer season,
        @Size(max = 16) String mediaFormat,
        Long subcategoryId,
        @Size(max = 32) String subcategory,
        @Size(max = 16) String status,
        @DecimalMin("0.0") @DecimalMax("10.0") BigDecimal rating,
        @Size(max = 2000) String note
) {
}
