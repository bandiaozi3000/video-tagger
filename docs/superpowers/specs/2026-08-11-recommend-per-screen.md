# 推荐导出：每屏同时展示 N 部（perScreen 网格分屏）

> 日期：2026-08-11 ｜ 范围：仅 recommend-chapter.html（章节样式）

## 需求背景（grill 确认）

某年份分组媒体过多时，组内「一部一屏」展示总时长爆炸（N 部 × 每屏停留时间）。用户希望**同一屏同时展示多部**（网格），大组几屏就能播完。

已确认决策：
- 「同时展示 N 部」可配置，档位 **1-10**，默认 1（保持现行为）。
- **每屏停留时长不变**（仍 `DETAIL_SEC`）；想多看就自己把时长调大。
- **分组 / 无分组直排都支持**。
- 网格卡显示：**封面 + 标题 + 备注 + 标签**（用户明确要求备注要显示；N 太大挤是用户自己控制的事）。
- 不处理的问题1（结尾墙 / 章节过场滚动不完）：用户暂缓，靠调大章节时长规避。

## 实现方案

### 后端（perScreen 透传，链路同 brandTitle）
- `RecommendService.buildHtml` 全签名尾部加 `Integer perScreen`，clamp 1-10 默认 1，注入模板占位符 `__PER_SCREEN__`；默认链 overload 补 `1`。
- `RecommendVideoService.render` / `VideoExportTaskService.create+runAsync` / `RecommendController.RecommendExportRequest` + html/video 两处透传。

### 模板（recommend-chapter.html）
- JS 读取 `const PER_SCREEN = clamp(__PER_SCREEN__, 1, 10);`
- 分组 + 无分组两种路径：把媒体按 `PER_SCREEN` 分块，每块渲染成一个「网格屏」（新 `.grid-screen` section），块内 N 张卡（封面+标题+备注+标签）。
- `PER_SCREEN === 1` → 完全走现有单部 story-card 逻辑（行为不变）。
- 每网格屏 hold = `DETAIL_SEC`（不变）；章节页 / 结尾 / 开场不动。
- 网格行列自适应：N=2→(2,1) 3→(3,1) 4→(2,2) 5→(3,2) 6→(3,2) 7→(4,2) 8→(4,2) 9→(3,3) 10→(5,2)。
- 组徽章「第 X-Y/N 部」显示当前屏覆盖区间；右侧导航「详情」计数 = 网格屏数。

### 前端（app.js / index.html）
- 步骤3（页面·交互）加「每屏同时展示 N 部」控件（1-10 步进）。
- `collectRecommendConfig` / `applyRecommendConfig` 含 `perScreen`；预览 HTML / 下载 HTML / 导出视频三处 POST body 透传。
- `computeRecommendDuration`：详情段时长 = `ceil(详情屏数) × detailSec`（屏数 = 分块数），与模板口径一致。

## 验证
- 单测：buildHtml 注入 `__PER_SCREEN__`（默认 1 / 自定义 N / 越界 clamp）。
- 浏览器端到端：N=2/4 分组 + 无分组预览网格渲染、每屏卡数正确、时长估算同步、导出 HTML 生效。
