package com.videotagger.service;

import java.util.List;

/** 通用分页结果：items=当前页数据，total=过滤后总条数。 */
public record PageResult<T>(List<T> items, long total) {
}
