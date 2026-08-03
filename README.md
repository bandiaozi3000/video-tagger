# Video Tagger

网页视频片段打标签 + 自然语言搜索 + 一键回看的本地私有化工具（Java + Spring Boot + MySQL + Milvus + 浏览器扩展）。

在 B站 / YouTube 等任意含 `<video>` 的网页看片时，按 `Alt+S` 打标签；之后在 Web UI 里用自然语言搜索、按视频时间线回顾，点击结果一键跳回对应片段。

## 功能

- **番剧三层打标**：番剧 → 集(含季) → 片段三层，均可打标；打标自动按标题归组番剧/集，浮层显示识别归属（A 做轻），列表「待确认」批量审核兜底（B 做全）。
- **秒级打标**：`Alt+S` 弹浮层；`Ctrl+Shift+1~9` 快捷标签位（可静默直存）；连续打标模式时间戳实时跟随；标签输入自动补全。
- **重复片段提示**：同一片段已存过时提示，可"追加标签"合并或"仍然新增"。
- **番剧管理**：卡片墙 + 详情页，封面（og:image 自动抓取 + 手动上传 + 无封面自动用代表性片段帧兜底）、追番状态、内容类型（动画/电影）、手动评分、作品标签、最近观看；创建 / 编辑 / 改名 / 合并 / 级联删除（含封面文件）。
- **帧封面（双图）**：片段打标时扩展一次截两档——320px 缩略图 + 详情大图；列表左侧缩略图横排，**鼠标悬浮弹出详情大图预览**；每集可从该集片段帧里自选高能画面作集封面（未选智能默认用被标记最多的片段帧）。
- **集 / 片段详情页**：点片段卡片进片段详情（大图 + 元信息 + 集/番剧导航 + 去原视频/编辑/删除 + 同集其他片段 + 相似片段）；点集卡片进集详情（封面 + 标签管理 + 打标签/设封面/去原视频 + 该集片段列表）。两页逻辑一致，可链式跳转逐层返回。
- **三层混合检索**：搜索维度可选（番剧 / 集 / 片段 / 混合），MySQL 关键词 + Milvus 向量召回 + RRF 融合；未配置 Embedding API 时自动降级纯关键词。
- **视频时间线**：同一视频的所有标记点沿时间轴排布，点击即跳回；分 P 视频正确聚合。
- **收藏夹与筛选器**：多对多自定义清单（整体浏览）；番剧按状态 / 类型 / 收藏夹 / 待确认筛选。
- **LLM 后台归组**：可开关，自动识别别名 / 不同季 / 不同翻译的同一番剧并合并。
- **相似片段推荐**：同标签优先 + 向量近邻，顺藤摸瓜找一筐。
- **看完自动弹**：扩展监听播放进度（默认关），看完一集提示给整集打标签。
- **统计面板**：总量、Top 标签、站点分布、近 30 天趋势。

## 快速开始

前置：Docker Desktop（Windows）。

```powershell
git clone <repo> video-tagger
cd video-tagger
copy .env.example .env   # 可选：填入 Embedding API 配置以启用语义搜索
docker compose up -d
```

1. 浏览器 `chrome://extensions` → 开发者模式 → 加载已解压扩展 → 选择 `extension/` 目录。
2. 打开 `http://localhost:8080` 进入搜索页（搜索 / 时间线 / 统计三个视图）。
3. 看视频时按 `Alt+S` 打标签；在搜索页用自然语言检索，点击结果自动跳转到对应片段。
4. 扩展设置页可配置后端地址、`Ctrl+Shift+1~9` 快捷标签位与静默直存。

> 安全：后端默认只监听 `127.0.0.1`，Embedding API Key 只从 `.env` 注入，请勿硬编码进配置文件。

## 常用命令

```powershell
docker compose up -d        # 启动全栈
docker compose down         # 停止（数据保留在卷中）
docker compose logs -f app  # 查看后端日志
```

## 开发

```powershell
docker compose up -d mysql etcd minio milvus attu  # 仅起基础设施
mvn -f backend/pom.xml spring-boot:run         # 本地跑后端
mvn -f backend/pom.xml test                    # 跑测试（需 Docker 运行中，Testcontainers）
```

## 架构

- 后端：`POST /api/clips`（保存，自动归组番剧/集，含截帧封面）、`GET/PUT/DELETE /api/clips/{id}`（详情/编辑/删除/追加）、`GET /api/search?dim=`（三层混合检索）、`GET /api/search/similar`（相似推荐）、`GET /api/anime` + `/{id}` + `/recent` + `/episodes`（番剧档案与最近观看）、`POST /api/anime/{id}/rename|merge|confirm|cover`、`GET/POST/DELETE /api/collections`（收藏夹）、`GET /api/videos` + `/{fp}/clips`（时间线）、`GET /api/stats`（统计）、`GET /api/tags`（补全）、`GET /api/clips/near`（邻近提示）、`GET /api/episodes/{id}`（集详情）+ `POST .../cover`（集封面上传）+ `/cover-from-clip/{clipId}`（自选片段帧）、跳转队列。
- 存储：MySQL（三层 schema + 标签词库与全文索引）+ Milvus（三层向量，单 collection 组合主键）+ Flyway 迁移；封面本地落盘 `data/covers/{anime}.{ext}`、`clip/{id}.jpg`、`ep/{id}-{ver}.jpg`，`/covers/**` 静态映射，不上 minio。
- 扩展：Manifest V3，Shadow DOM 浮层，background 转发后端请求，看完自动弹。
- 文档：番剧三层打标设计见 `docs/superpowers/specs/2026-08-03-video-tagger-anime-tiered-design.md`，实施计划见 `docs/superpowers/plans/2026-08-03-video-tagger-anime-tiered-phase1~3-plan.md`。
