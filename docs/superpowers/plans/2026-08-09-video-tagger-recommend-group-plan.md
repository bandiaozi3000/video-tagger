# 推荐导出分组（stream 连续流式）实施计划

- 日期：2026-08-09
- 版本：0.17.0
- spec：`docs/superpowers/specs/2026-08-09-video-tagger-recommend-group-design.md`

## 实施步骤

### Step 1：后端分组数据（RecommendService）
1. 注入 `MediaCollectionMapper`、`CollectionMapper`。
2. `slideOf` 加 `groupBy` 参数 + group 字段计算（year/subcategory/collection/none）。
3. `buildSlidesJson(ids, groupBy)` 按组分排序（year 降序 / 其他首次出现序，组内保持 ids 序）。
4. `buildHtml` 新增全参重载（含 groupBy），旧签名委托 null。

### Step 2：视频链路 + Controller 透传
1. `RecommendVideoService.render` 加 `groupBy` 参数（重载兼容旧签名），内部 `buildHtml(...,groupBy)`。
2. `RecommendController` html/video 从 body 透传 groupBy。

### Step 3：后端单测
1. `RecommendServiceTest` 构造器补 2 个 mapper mock。
2. 新增用例：groupBy 各维度 + 组序 + 兜底组 + none。
3. `RecommendVideoServiceTest` 补 groupBy 透传断言。

### Step 4：模板改造（templates/recommend.html）
1. 基于 stream 样板：保留正式模板全部（占位符/BGM/星空/record/交互/完整 Story 卡）。
2. 加组横幅 CSS + 组徽章 CSS。
3. JS：SLIDES 分组（有 group → 横幅+徽章；无 → 直排）+ 自动导览 hold 差异 + trackbar 组信息。

### Step 5：前端向导
1. index.html 步骤2 加「分组方式」下拉。
2. app.js：`recommendGroupBy()` + html/video 请求带 groupBy + 视频 30 上限前端校验提示。

### Step 6：验证
1. `mvn -q test -o -Dtest=RecommendServiceTest,RecommendVideoServiceTest`。
2. 静态资源复制 target/classes/static + 浏览器手工全流程。
3. `?record=1` 录制模式抽查。

### Step 7：版本 + 文档
1. pom 0.16.0 → 0.17.0；CHANGELOG [0.17.0]；story v0.17 叙事段。
2. worklog 2026-08-09 追加。
