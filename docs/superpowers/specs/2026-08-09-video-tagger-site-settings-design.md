# 网站设置 + 背景图轮播 设计

日期：2026-08-09　目标版本：v0.19（暂定）

## 需求

网站加「设置」功能，首个设置项为**网站背景图**，支持**多图轮播**。用户先看 UI/交互/功能方案，拍板后实施。

## 拍板决策（AskUserQuestion）

1. **入口**：header 右上角 **⚙ 齿轮图标按钮**（不占导航 tab 位）。
2. **存储**：**后端持久化**——图片落盘 `data/site/bg/`，配置存 DB 键值表 `site_setting`（新 Flyway V15）。localStorage 5MB/清缓存丢，不适合网站级设置。
3. **调节**：多图 + 轮换时间 + 透明度 + 模糊（不只有单图上传/移除）。

## 功能设计

### 入口
`header-inner` 右侧（nav 之后）加 ⚙ 图标按钮，点击弹设置弹窗。

### 设置弹窗
沿用项目 modal 体系（深色渐变底、圆角、顶部粉紫渐变光带），**左侧分类 + 右侧内容**的设置中心布局（为扩展设置项预留）：
- 左侧分类列表：`外观`（当前唯一，未来加字体/主题色/数据等）
- 右侧「外观」内容：
  - **预览区**：当前背景轮播效果（第 1/N 张淡入淡出）
  - **添加背景图**（multipart 多选 ≤8MB/张）
  - **已添加列表**：缩略图 + 单张「×移除」
  - **轮换时间滑块**（5~60s，默认 15s）
  - **透明度滑块**（30~90%，默认 60%，保证内容可读）
  - **模糊度滑块**（0~60%，默认 30%，毛玻璃柔化）
  - 「移除全部背景」恢复默认深色底
- 底部操作：取消 / 保存（实时预览，点保存才持久化）

### 背景应用
- body 加 `fixed` 全屏背景层（`z-index` 最低），多图定时轮播（`setInterval` 按轮换时间切图，opacity 淡入淡出过渡），深色遮罩 `rgba(10,10,21,透明度)`。
- 页面加载时 `GET /api/settings` 自动应用已存配置。
- 现有 header/内容/弹窗都在背景之上，可读性不受影响。

### 存储与接口
- **图片**：`data/site/bg/{时间戳}_{原名}` 落盘，静态映射 `/site/bg/**`（WebConfig 加 resource handler，参照 `/covers/**`）。
- **配置**：`site_setting` 键值表（key VARCHAR PK, value TEXT/JSON）。配置 JSON：
  ```json
  { "bgImages": ["/site/bg/xxx.jpg", ...], "rotationSec": 15, "opacity": 0.6, "blur": 30 }
  ```
- **接口**：
  - `GET /api/settings` → 当前配置（页面加载应用）
  - `PUT /api/settings` → 保存配置（轮换时间/透明度/模糊 + 图片顺序）
  - `POST /api/settings/bg`（multipart `files`）→ 追加上传图片，返回完整配置
  - `DELETE /api/settings/bg/{fileName}` → 移除单张（同步删文件），返回完整配置

### 扩展性
- 弹窗左侧分类列表即扩展位；`site_setting` 键值表天然承载任意新设置 key。

## 涉及文件（预估）
- 后端：`V15__site_setting.sql`、`SettingsService`、`SettingsController`、`SettingsProperties`（site-dir）、`WebConfig` 加映射
- 前端：`index.html`（齿轮 + 设置弹窗）、`app.css`（设置弹窗/背景层/滑块）、`app.js`（设置弹窗逻辑 + 背景轮播应用）
