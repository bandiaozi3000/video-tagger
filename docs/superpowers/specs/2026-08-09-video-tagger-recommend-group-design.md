# 推荐导出分组（三样式可勾选）设计

- 日期：2026-08-09
- 版本：0.17.0
- 状态：grilling 确认（含中途调整：分组样式改为三选一可勾选），直接实施

## 需求（用户原话归纳）

1. **开局展示可勾选要显示的媒体** → 推荐向导开局即可勾选；**勾选多少由用户决定**，不强制限制（已选计数实时显示；分组预览直观看到每组数量）。
2. **分组展示**：按**时间 / 分类 / 收藏夹**等分组（后续可细分）；**切换分组有转场提示**，**组内页面有分组提示**。
3. **分组样式可勾选（中途调整）**：**三套分组呈现样式都保留、由用户勾选**——流式横幅（stream，默认）/ 章节式（chapter）/ 总览导航式（overview）。

## grilling 拍板

| 决策点 | 结论 |
|---|---|
| 分组方式入口 | **步骤2「设置主题」旁加「分组方式」下拉** |
| 分组维度（首期） | 不分组（默认）/ 按年份 / 按分类子分类 / 按收藏夹，全支持 |
| 分组样式 | **三选一可勾选**：stream（默认）/ chapter / overview |
| 勾选数量控制 | **不强制**，用户决定；已选计数实时显示 + 预览直观呈现每组数量 |
| overview 修复 | 总览/组内卡片显示不再依赖 IO 时序（主动加 in-view）+ 修数字/字符串严格比较 bug（已修，docs/design 版验证通过） |

## 数据流

```
前端向导步骤2 选 groupBy + groupStyle → POST /api/recommend/html|video
  body: { ids, title, format, resolution, bgmName, bgmBase64, groupBy, groupStyle }
    → RecommendController 透传
    → RecommendService.buildHtml(ids, title, bgmName, bgmBase64, groupBy, groupStyle)
      → SLIDES_JSON 每项追加 group 字段（按维度取值）+ 按组分排序
      → 按 groupStyle 读 templates/recommend-{stream|chapter|overview}.html 替换占位符
    → 模板 JS：SLIDES 有 group → 按样式渲染分组；无 group → 不分组直排
```

## 后端设计

### 1. `RecommendExportRequest`（RecommendController record）
新增 `String groupBy`（`none|year|subcategory|collection`，空/未知 → none）+ `String groupStyle`（`stream|chapter|overview`，空/未知 → stream）。

### 2. `RecommendService`
- **新增注入**：`MediaCollectionMapper`（selectCollectionIdsByMedia）+ `CollectionMapper`（取收藏夹名）。
- `slideOf(MediaDetail d, String groupBy)`：追加 `group`
  - `year`：`d.year()==null ? "未知年份" : d.year()+" 年"`
  - `subcategory`：`subcategoryPath(...)`，空 → `"未分类"`
  - `collection`：首个收藏夹名，空 → `"未收藏"`
  - `none`：不加 group
- `buildSlidesJson(ids, groupBy)`：逐 id → slideOf；**按组排序**（year 数字降序 / 其他首次出现序；组内保持 ids 序）。
- `buildHtml(ids, title, bgmName, bgmBase64, groupBy, groupStyle)`：按 style 读模板 `templates/recommend-{style}.html`；旧签名委托 `groupBy=null, groupStyle="stream"`。

### 3. `RecommendVideoService.render`
- 加 `groupStyle` 参数（重载兼容旧签名），内部 `buildHtml(...,groupBy,groupStyle)`。保留 `MAX_MEDIA_COUNT=30`。

### 4. `RecommendController`
- html/video 透传 `groupBy` + `groupStyle`。

## 模板设计（templates/ 三套）

基于 docs/design 三套 + 正式模板补齐：
- **三文件**：`recommend-stream.html`（默认）/ `recommend-chapter.html` / `recommend-overview.html`
- **三套共通**：占位符 `__TITLE__/__SLIDES_JSON__/__BGM_SRC__/__BGM_NAME__`、星空粒子、霓虹雾、顶部光带、`?record=1`、BGM 胶囊、自动导览、底部轨道条、wheel/touch/键盘停导览、**完整 Story 卡**（封面/Ken Burns/编号描边/分类 pill/标题/备注/标签 chips）。
- **分组呈现**（SLIDES 有 group 才生效；无 group 直排不显示分组元素）：
  - stream：组间斜切转场横幅（EPISODE 编号 + 组名大字 + 数量 + 封面墙错落）+ Story 组徽章。
  - chapter：组前整屏章节页（CHAPTER 编号 + 组名 + 封面缩略行）+ Story 组徽章。
  - overview：开场后分组总览页（组卡选组）+ 顶部导航 chips 切组 + 全屏转场页 + 组徽章；**修 IO 时序 + 数字/字符串比较 bug**。
- **自动导览**：分组元素（横幅/章节页/总览）短停留，组内 Story 6000ms；trackbar 显示「{组名} · 章节转场 / 第 i/N 部」。
- **组序尊重后端**：模板按 SLIDES 数组顺序分组（首次出现序），不重排。

## 前端设计

### index.html
- 步骤2 加「分组方式」下拉 `#recommend-group-by`（不分组/年份/分类/收藏夹）+「分组样式」下拉 `#recommend-group-style`（流式横幅/章节式/总览导航式）。分组方式选「不分组」时样式下拉禁用/不生效。

### app.js
- `recommendGroupBy()` / `recommendGroupStyle()`；html/video 请求 body 带两者。
- 视频导出 30 上限前端校验提示（HTML 不限制）。
- 勾选自由，已选计数保留。

## 边界 / 反馈
- groupBy=none → 不分组直排；groupStyle 未知 → stream。
- 组名空兜底：未知年份 / 未分类 / 未收藏。
- 收藏夹维度取首个收藏夹（按 collection_id 排序）。
- 分组只影响导出模板展示，不落库。

## 测试计划
- `RecommendServiceTest`：构造器补 mapper mock；groupBy 各维度 + 组序 + 兜底；groupStyle 选模板断言。
- `RecommendVideoServiceTest`：groupBy/groupStyle 透传。
- 手工：向导全流程（勾选 → 选维度+样式 → 预览 iframe 三样式各看一遍 → 导出 HTML/视频）；`?record=1` 三样式抽查。

## 涉及文件
- 改：`RecommendController`、`RecommendService`、`RecommendVideoService`、`templates/recommend-stream|chapter|overview.html`（新增二）、`index.html`、`app.js`、`RecommendServiceTest`、`RecommendVideoServiceTest`、`pom.xml`(0.17.0)、`CHANGELOG.md`、`docs/story.md`
- 已修：`docs/design/recommend-group-overview.html`（显示 bug）
- 新增：本 spec + plan
