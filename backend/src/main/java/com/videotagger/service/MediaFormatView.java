package com.videotagger.service;

import java.util.List;

/** 媒体格式维护视图：一个格式 + 其下子分类（含每子分类媒体数）。 */
public record MediaFormatView(Long id, String code, String name, Integer hasChildren,
                              List<SubcategoryView> subcategories) {

    public record SubcategoryView(Long id, String name, Long mediaCount) {
    }
}
