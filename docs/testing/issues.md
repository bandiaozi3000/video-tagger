# 问题清单（按日记录）

> 本清单登记**使用过程中碰到的问题**，按日期每日记录：每日一段、往底部追加，顶部有目录索引可快速定位日期。
>
> **机制**：
> - 问题默认 **待修复** 状态；**累计满 5 个待修复 → 主动提醒用户，确认后批量修复**，修复完成后记录变更。
> - **紧急问题**用户直接指定「立即修复」，不等累计，单独修完也记录。
> - **严重程度**：🔴 严重（功能不可用/崩溃/数据损坏）/ 🟧 一般（有明显缺陷）/ 🟨 轻微（小瑕疵/样式/优化）。严重度不决定修复节奏，只标注影响；紧急与否由用户口头指定。
> - 每个问题必须记录：**现象 / 原因 / 修复方式** 等必要信息。
> - **前提**：任何问题先**验证**（复现 / 读码佐证）再修；若验证**非 bug**（操作不当 / 理解偏差）→ 告知原因，标注「非 bug（无需修复）」并存档，不入待修队列、不占累计数。
>
> 相邻文档：功能需求 → `docs/testing/feature-requests.md`；疑问与解答 → `docs/testing/test-qa.md`。

## 计数

- **当前待修复**：0 个（批量阈值：满 5 个一起修）
- **问题编号**：#1 起**全局递增**（跨日连续，不按日重置），紧急/批量不影响编号
- 已累计处理：#1、#2、#3、#4、#5（已修复）

## 目录（按日期）

- [2026-08-11](#2026-08-11)
- [2026-08-10](#2026-08-10)

---

## 记录模板（新问题按此追加）

```
### [#N] 一句话标题
- **日期**：YYYY-MM-DD
- **状态**：待修复（默认） / 已修复 / 非 bug（无需修复）
- **紧急**：否（默认） / 是（用户指定立即修复）
- **严重程度**：🔴 严重 / 🟧 一般 / 🟨 轻微
- **现象**：xxx
- **原因**：xxx（验证结论；非 bug 则写「非 bug：操作不当 / 理解偏差」）
- **修复方式**：xxx（修复思路 / 涉及文件；非 bug 写「无需修复」）
- **变更记录**：xxx（修复 commit / 变更内容 / 影响版本）
```

---

## 2026-08-10

### [#1] 回收站「彻底删除/清空」弹窗太 Low，与网站风格不统一
- **日期**：2026-08-10
- **状态**：已修复
- **紧急**：否
- **严重程度**：🟨 轻微（UI 风格不统一）
- **现象**：回收站「彻底删除」「清空回收站」用的是浏览器原生 `confirm()` 弹窗，与全站毛玻璃弹窗风格不搭。
- **原因**：`purgeTrash` / `clearTrash` 绕过了项目已有的 `showConfirm()` 通用确认弹窗（app.js:270），直接用了原生 `confirm()`；同类的还有设置页「移除全部背景图」（`clearAllBgImages`）。
- **修复方式**：三处原生 `confirm()` 全部改为 `showConfirm()`（标题/提示/危险主按钮/onOk 回调），`clearAllBgImages` 的 IIFE `(async()=>{...})()` 闭合符同步改为 `onOk` 回调收尾。
- **变更记录**：2026-08-10 修复，`app.js`（purgeTrash / clearTrash / clearAllBgImages），`node --check` 语法通过、grep 原生 `confirm(` 清零、已复制到 `target/classes/static`。

### [#4] 切列表再切卡片，卡片显示大小异常（容器 class 残留）
- **日期**：2026-08-10
- **状态**：已修复
- **紧急**：否
- **严重程度**：🟧 一般（视图切换后卡片布局异常，需刷新恢复）
- **现象**：卡片/列表单按钮切换，切列表再切回卡片，媒体卡片被拉成一列、大小异常。
- **原因**：`renderMediaRow`/`renderRecommendRow` 给容器永久 `classList.add('media-list')`（flex 竖排），切回卡片视图未移除 → 容器 class 残留 `media-grid media-list`、`display:flex`，卡片脱离 grid 布局。
- **修复方式**：卡片分支（`renderMediaGrid`/`renderRecommendGrid`）开头 `classList.remove('media-list')`；收藏夹平铺分支 `className='media-grid'` 复位、分组分支 `className='coll-group-wrap'` 直接赋值。
- **变更记录**：2026-08-10 修复，`app.js`；浏览器验证容器 class 切换正确（card→media-grid/grid、分组↔平铺正确复位）。顺带暴露浏览器缓存 app.js 坑 → index.html 给 app.js 引用加 cache-bust `?v=20260810`。已复制 target。

### [#3] 媒体详情编辑状态永远被重置为「想看」（id 冲突）
- **日期**：2026-08-10
- **状态**：已修复
- **紧急**：是（用户排查后指定按此思路修复）
- **严重程度**：🔴 严重（编辑状态功能不可用）
- **现象**：媒体详情点「编辑信息」改状态保存后，**强刷新状态未改变、详情封面右侧基本信息状态未改变**——任何状态改动保存后都被存成「想看」(WANT)。用户排查发现「PUT 传的 status 恒为 WANT」。
- **原因**：**id 冲突**——index.html 有两处 `id="media-status"`：① 126 行媒体列表**状态提示条 `<div>`**；② 636 行编辑弹窗**状态下拉 `<select>`**。`getElementById('media-status')` 恒返回第一个 **div**，导致 `mediaStatusSelect` 指向 div：`openEditMedia` 回显设到 div（无用）、`saveMedia` 读 `div.value` = **undefined** → JSON 序列化省略 → PUT body **无 status 字段** → 后端 `apply` 兜底 `STATUSES.contains(null)?... : "WANT"` → 每次保存都强制存成 WANT。
- **修复方式**：编辑弹窗状态下拉 id 改 **`media-status-select`**（index.html:636），`app.js` 的 `mediaStatusSelect` 引用同步改为 `getElementById('media-status-select')`（app.js:86）；div 的引用（mediaStatusEl/1932/1946）保持 `media-status` 不变。
- **变更记录**：2026-08-10 修复。验证：浏览器实测——改状态「看完」→ 保存 → PUT body `status:"DONE"`（不再缺字段）、后端存 DONE、弹窗关闭、详情 ad-meta 刷新为「看完」；`media-status` 计数从 2 → 1。修复前后用 eval 全流程对比，排除 saveMedia/后端因素（后端 API 一直正常）。已复制 `target/classes/static`。

### [#2] CollectionServiceIT / CoverServiceIT 过时编译失败，卡死 mvn test
- **日期**：2026-08-10
- **状态**：已修复
- **紧急**：否
- **严重程度**：🟧 一般（阻塞全部测试执行）
- **现象**：`mvn test` 在 test-compile 阶段报 `CollectionServiceIT:33,36`（`collectionService.media(...)` 参数不匹配）和 `CoverServiceIT:188`（`mediaService.list(...)` 参数不匹配），**任何测试都跑不起来**。
- **原因**：两个 IT 引用的是**老签名**——v0.8~v0.10 给 list/media 查询加筛选参数（q/collectionId/tagId 等）后，这两个测试未同步更新（当时用 `-Dtest` 指定单测绕过了全量编译，问题被掩盖）。
- **修复方式**：把两个 IT 的调用签名更新为当前方法签名——`CollectionServiceIT` 的 `media(...)` 补第 10 参 `q`（与 `CollectionService.media` 10 参对齐），`CoverServiceIT` 的 `list(...)` 补第 13 参 `tagId`（与 `MediaService.list` 13 参对齐）。
- **变更记录**：2026-08-10 修复。改动在工作区（未提交）：`CollectionServiceIT.java:33,36` + `CoverServiceIT.java:188` 各补一个 `null`。验证：`mvn -o test-compile` 通过；`-Dtest='CollectionServiceIT,CoverServiceIT'` 单独跑 14 测全绿（Collection 1 + Cover 13，BUILD SUCCESS）。

### [#5] RecommendServiceTest 封面大小断言过期（v0.18 改 0-100 滑块后测试没跟上）
- **日期**：2026-08-11
- **状态**：已修复
- **紧急**：否
- **严重程度**：🟨 轻微（仅单测红，功能正常）
- **现象**：`RecommendServiceTest.buildHtmlInjectsBgmTracksSubtitleAndOpen:267` 断言 `html.contains("{ sm: .85, md: 1.15, lg: 1.4 }['lg']")` 恒 false，跑 `-Dtest='RecommendServiceTest'` 时红（改动前就已失败，非本次引入）。
- **原因**：封面大小 v0.18 从 sm/md/lg 三档改为 **0-100 滑块**（模板 `COVER_COEF = 0.65 + Number('__COVER_SIZE__') / 100`，后端 `normalizeCoverSize` 归一 0-100），旧断言仍按三档格式写。测试传 `"lg"` 非法 → `normalizeCoverSize` 回退 `"50"`。
- **修复方式**：断言改为 `html.contains("COVER_COEF = 0.65 + Number('50') / 100")`，与当前模板/归一逻辑对齐。
- **变更记录**：2026-08-11 修复。`RecommendServiceTest.java` 断言更新；验证 `-Dtest='RecommendServiceTest'` 19 测全绿。
