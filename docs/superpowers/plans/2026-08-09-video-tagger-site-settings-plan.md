# 网站设置 + 背景图轮播 实施计划

日期：2026-08-09　目标：v0.19（暂定）

## 阶段 1：后端

1. **Flyway `V15__site_setting.sql`**：`site_setting`（key VARCHAR(100) PK, value TEXT）。
2. **`SettingsProperties`**：`videotagger.site-dir`（默认 `data/site`）。
3. **`SettingsService`**：
   - 配置读写：`getSettings()` / `saveSettings(SettingsRequest)`，JSON 存 `site_setting` 表（key=`site`）。
   - `SettingsDTO`：`bgImages`（按序 URL 列表）、`rotationSec`、`opacity`、`blur`。
   - 上传：`addBgImages(MultipartFile[])` 存 `data/site/bg/`（时间戳_原名，防重复），更新配置图片列表追加。
   - 移除：`removeBgImage(fileName)` 删文件 + 从配置列表移除（文件名白名单校验防目录穿越，只删 `/site/bg/` 下）。
4. **`SettingsController`**：GET/PUT `/api/settings`、POST `/api/settings/bg`、DELETE `/api/settings/bg/{fileName}`。
5. **`WebConfig`**：加 `/site/bg/**` → `data/site/bg/` 静态映射（参照 covers）。

## 阶段 2：前端

1. **index.html**：header 右上 ⚙ 按钮；设置弹窗（modal 左分类右内容）：
   - 预览区、添加按钮（hidden file multiple）、已添加缩略图列表（每张 × 移除）、轮换时间/透明度/模糊三个 range 滑块 + 数值、移除全部、取消/保存。
2. **app.css**：设置弹窗样式（沿用 modal 体系 + 左侧分类栏）；`.bg-layer`（fixed 全屏 z-index:-1）+ `.bg-fade`（淡入淡出）；range 滑块样式（霓虹色）。
3. **app.js**：
   - 打开/关闭设置弹窗；加载 `GET /api/settings` 填充。
   - 上传 → `POST /api/settings/bg` → 刷新列表 + 预览；单张移除 → `DELETE .../{name}`。
   - 滑块变化 → 实时更新预览层（不落库）；保存 → `PUT /api/settings` + toast。
   - **背景轮播**：`initSiteBackground()` 页面加载读配置 → 建多图 `bg-layer`，`setInterval(rotationSec)` 切换 active 图层淡入淡出。
4. 静态复制到 `target/classes/static`。

## 阶段 3：验证

- 后端：mvn compile；curl 测 GET/PUT/POST/DELETE /api/settings 全链路。
- 前端：node --check；puppeteer 连后端开设置弹窗截图/检查 DOM；上传测试图验证落盘 + 轮播图层生成。
- 回归：确认背景层不影响导航/卡片/弹窗可读性。
