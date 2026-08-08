# Video Tagger 搜索来源筛选 + 搜索 UI 折叠重构设计（v0.15 内补充）

> 日期：2026-08-08
> 前置：用户要求①搜索加「来源」区分；②重新设计搜索 UI——「后续搜索项可能过多，页面较为臃肿」，要简洁又能满足不同搜索需求。
> 目标：搜索区重构为「常用项常驻 + 更多筛选折叠」的可扩展布局，新增来源下拉筛选（MANUAL/ANILIST/OMOFUNA）。
> 版本：并入 **v0.15.0**。

## 1. 决策记录（grilling 已拍板）

| # | 决策 | 选项 |
|---|---|---|
| 1 | 筛选区形态 | **折叠式更多筛选**：常用项（格式/子分类/来源）常驻一行；「更多筛选」按钮展开次要项（时间/自定义区间/按媒体聚合 + **未来新增项**）。默认收起页面简洁，可扩展不臃肿 |
| 2 | 来源控件 | **下拉**（与格式/子分类一致）：全部 / 手动 / AniList 同步 / omofuna 同步，单选默认全部 |
| 3 | 来源语义 | 搜索结果按**所属媒体的 source** 后置过滤（media 维度结果用自身 source；clip/episode 用 enrich 补的所属媒体 source） |

## 2. 后端改动

### 2.1 `SearchResult` record 加 `source`

- 在 `subcategoryId` 后、`createdAt` 前加 `String source`（所属媒体来源，MEDIA 结果即自身 source）。
- **连锁**：全参构造调用点 4 处补参——`toMediaResult`（`a.getSource()`）、`toClipResult`（null）、`toEpisodeResult`（null）、`enrich`（`m.getSource()`）；兼容构造器（片段结果 8 参）末尾补 `null`。

### 2.2 `SearchService.search` 加 source 过滤

```java
public SearchResponse search(String query, int limit, int offset, String dim, String format,
                             Long subcategoryId, Long from, Long to, String source) {
    boolean filtered = ... || (source != null && !source.isBlank());
    ...
    .filter(r -> matchFormatSubcategory(r.mediaFormat(), r.subcategoryId(), format, subtree))
    .filter(r -> matchSource(r.source(), source))
}

private static boolean matchSource(String resultSource, String source) {
    return source == null || source.isBlank() || source.equalsIgnoreCase(resultSource);
}
```

- 与 format/subcategory 同为**后置过滤**（过滤在 enrich 后、分页前做，total 准）。

### 2.3 `SearchController`

- `@RequestParam(required=false) String source` 透传。

## 3. 前端 UI 重构

### 3.1 结构（index.html 搜索区）

```html
<div class="search-filters">                <!-- 常驻行：常用筛选 -->
    <select id="search-format">…</select>   <!-- 格式 -->
    <select id="search-subcategory">…</select>
    <select id="search-source">             <!-- 新增：来源 -->
        <option value="">来源</option>
        <option value="MANUAL">手动</option>
        <option value="ANILIST">AniList 同步</option>
        <option value="OMOFUNA">omofuna 同步</option>
    </select>
    <button type="button" id="search-more-btn" class="search-more-btn">更多筛选 ▾</button>
</div>
<div class="search-filters-more" id="search-filters-more" hidden>   <!-- 折叠区：次要项 + 未来项 -->
    <select id="search-time">…</select>
    <span id="search-time-custom">…</span>
    <label class="search-group-toggle">…</label>
</div>
```

### 3.2 交互（app.js）

- `runSearch` 收集 `source`：`if (SEARCH_SOURCE_SELECT.value) sp.set('source', ...)`。
- 「更多筛选」toggle：点按钮 → `.search-filters-more` hidden 翻转 + 按钮箭头 ▾/▴（默认收起）。

### 3.3 样式（app.css）

- `.search-more-btn`：贴合 `.btn-mini` 但更紧凑（小号、强调色），hover 变紫。
- `.search-filters-more`：第二行 flex（margin-top 分隔），与常驻行对齐；展开/收起平滑过渡。
- 来源下拉复用现有 `.search-filters select` 样式（无需新控件样式）。

## 4. 测试

- `SearchServiceTest`：source 过滤——`search(...,"OMOFUNA")` 只保留 source=OMOFUNA 的结果；null/空 source 不过滤。
- `SearchControllerTest`：`/api/search?source=OMOFUNA` 透传参数。
- SearchResult 构造连锁：测试里若有手动 `new SearchResult(...)` 补参。

## 5. 验证方案

1. 起后端：`/api/search?q=番&source=OMOFUNA` 结果全 omofuna；`source=MANUAL` 结果全手动。
2. 前端：搜索区常驻「格式/子分类/来源 + 更多筛选」；点更多展开时间/聚合；来源下拉选中后搜索请求带 source。
3. 单测 `mvn -o -Dtest='SearchServiceTest,SearchControllerTest'` 全过。

## 6. 非目标

- 不做来源统计/来源单独筛选页（字段与筛选已就绪，后续按需加）。
- 不做搜索条件保存/URL 记忆（当前搜索态随刷新丢失，后续需要再议）。
