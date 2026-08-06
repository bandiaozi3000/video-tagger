package com.videotagger.service;

import java.util.List;

/** 媒体格式维护视图：一个格式 + 其下子分类树（全量 flat，前端按 parentId 组树，含每节点子树媒体数）。 */
public record MediaFormatView(Long id, String code, String name, Integer hasChildren,
                              List<SubcategoryView> subcategories) {

    public record SubcategoryView(Long id, Long parentId, String name, Long mediaCount) {
    }
}
