# Video Tagger

网页视频片段打标签 + 自然语言搜索 + 一键回看的本地私有化工具（Java + Spring Boot + MySQL + Milvus + 浏览器扩展）。

在 B站 / YouTube 等任意含 `<video>` 的网页看片时，按 `Alt+S` 打标签；之后在 Web UI 里用自然语言搜索、按视频时间线回顾，点击结果一键跳回对应片段。

## 功能

- **媒体分层打标**：**媒体 → 集(含季) → 片段** 三层（视频）；媒体级（番剧/电视剧/美剧/电影…）与图片、文字等单层媒体均可打标。打标自动按标题归组媒体/集，浮层显示识别归属（A 做轻），列表「待确认」批量审核兜底（B 做全）。
- **媒体格式细分**：**媒体格式**（视频/图片/文字…）+ **子分类任意层级分类树**（视频：番剧 → 热血 → …，可逐级细分；图片/文字同理）。媒体可挂到树中**任意层级**节点，筛选/搜索**子树收敛**（选「番剧」能看挂在「热血」下的媒体）；媒体列表按格式 tab 一键切换，新建媒体可内联「＋ 新建」子分类，另设「⚙ 管理格式」弹层做格式/子分类树增删（节点有下级或挂媒体拒绝删除）。
- **媒体/集/片段三级备注**：片段备注打标时即可填；媒体备注在「新建/编辑媒体」弹窗录入、详情页展示；集备注在集详情页内联编辑。备注**参与关键词与语义检索**，是标签之外的自由补充说明。
- **秒级打标**：`Alt+S` 弹浮层；`Ctrl+Shift+1~9` 快捷标签位（可静默直存）；连续打标模式时间戳实时跟随；标签输入自动补全（**按媒体上下文**：该媒体已用标签优先 + 全局高频兜底，扩展连续打标/Web 片段编辑/集打标/媒体加标签均接入）。
- **标签池管理（新 tab「标签」）**：通用池（全词条 + 媒体/集/片段三级引用计数 + 过滤）+ 按媒体维度视图；支持**改名**（同步 `clips.tag` 冗余列 + 引用实体自动重嵌）、**合并**（高然→高燃 这类同义词规范化）、**删孤儿**（仅无引用词条可删）。
- **重复片段提示**：同一片段已存过时提示，可"追加标签"合并或"仍然新增"。
- **媒体管理**：卡片墙 + 详情页，封面（og:image 自动抓取 + 手动上传 + 无封面自动用代表性片段帧兜底）、格式/子分类、状态、手动评分、作品标签、最近观看；创建 / 编辑 / 改名 / 合并 / 级联删除（含封面文件）。
- **帧封面（双图）**：片段打标时扩展一次截两档——320px 缩略图 + 详情大图；列表左侧缩略图横排，**鼠标悬浮弹出详情大图预览**；每集可从该集片段帧里自选高能画面作集封面（未选智能默认用被标记最多的片段帧）。
- **集 / 片段详情页**：点片段卡片进片段详情（大图 + 元信息 + 集/媒体导航 + 去原视频/编辑/删除 + 同集其他片段 + 相似片段）；点集卡片进集详情（封面 + 标签管理 + 打标签/设封面/去原视频 + 该集片段列表）。两页逻辑一致，可链式跳转逐层返回。
- **三层混合检索**：搜索维度可选（媒体 / 集 / 片段 / 混合），可按格式/子分类（子树收敛）/**打标时间范围**过滤；**命中词全字段高亮**；**「按媒体聚合」分组**（结果按所属媒体结构化展示，方便收集话题素材）；结果卡片带格式/子分类/站点角标与打标时间。MySQL 关键词 + Milvus 向量召回 + RRF 融合；未配置 Embedding API 时自动降级纯关键词。
- **视频时间线**：同一视频的所有标记点沿时间轴排布，点击即跳回；分 P 视频正确聚合。
- **收藏夹与筛选器**：多对多自定义清单（整体浏览）；媒体按格式/子分类（子树收敛）/状态/收藏夹/待确认筛选。
- **LLM 后台归组**：可开关，自动识别别名 / 不同季 / 不同翻译的同一媒体并合并。
- **相似片段推荐**：同标签优先 + 向量近邻，顺藤摸瓜找一筐。
- **看完自动弹**：扩展监听播放进度（默认关），看完一集提示给整集打标签。
- **统计面板**：总量、Top 标签、按格式/子分类分布、站点分布、近 30 天趋势。

## 快速开始

前置：Docker Desktop（Windows）。

```powershell
git clone <repo> video-tagger
cd video-tagger
copy .env.example .env   # 可选：填入 Embedding API 配置以启用语义搜索
docker compose up -d
```

1. 浏览器 `chrome://extensions` → 开发者模式 → 加载已解压扩展 → 选择 `extension/` 目录。
2. 打开 `http://localhost:8080` 进入搜索页（搜索 / 媒体 / 时间线 / 统计 / 标签五个视图）。
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

- 后端：`POST /api/clips`（保存，自动归组媒体/集，含截帧封面）、`GET/PUT/DELETE /api/clips/{id}`（详情/编辑/删除/追加）、`GET /api/search?dim=&format=&subcategory=&from=&to=`（三层混合检索 + 格式/子分类/**时间范围**过滤，结果带所属媒体元信息）、`GET /api/search/similar`（相似推荐）、`GET /api/media` + `/{id}` + `/recent` + `/episodes`（媒体档案与最近观看，list 支持 `status/format/subcategory/confirmed/sort`）、`POST /api/media/{id}/rename|merge|confirm|cover`、`GET/POST /api/media-formats` + 子分类 CRUD（格式/子分类维护，删除保护）、`GET/POST/DELETE /api/collections`（收藏夹）、`GET /api/videos` + `/{fp}/clips`（时间线）、`GET /api/stats`（统计，含按格式/子分类分布）、`GET /api/tags?prefix=&limit=&mediaId=`（补全，媒体上下文优先）、`GET /api/tags/manage?q=&mediaId=` + `PUT /api/tags/{id}`（改名）+ `POST /api/tags/merge`（合并）+ `DELETE /api/tags/{id}`（删孤儿，标签池管理）、`GET /api/clips/near`（邻近提示）、`GET /api/episodes/{id}`（集详情）+ `PUT /api/episodes/{id}`（更新集备注）+ `POST .../cover`（集封面上传）+ `/cover-from-clip/{clipId}`（自选片段帧）、跳转队列。
- 存储：MySQL（媒体分层 schema + 格式/子分类字典 + 标签词库与全文索引）+ Milvus（三层向量，单 collection 组合主键，媒体层前缀 "A" 沿用）+ Flyway 迁移；封面本地落盘 `data/covers/{media}.{ext}`、`clip/{id}.jpg`、`ep/{id}-{ver}.jpg`，`/covers/**` 静态映射，不上 minio。
- 扩展：Manifest V3，Shadow DOM 浮层，background 转发后端请求，看完自动弹。
- 文档：标签池设计见 `docs/superpowers/specs/2026-08-06-video-tagger-tag-pool-design.md`，实施计划见 `docs/superpowers/plans/2026-08-06-video-tagger-tag-pool-plan.md`；媒体格式细分设计见 `docs/superpowers/specs/2026-08-04-video-tagger-media-format-design.md`，实施计划见 `docs/superpowers/plans/2026-08-04-video-tagger-media-format-plan.md`；番剧三层打标设计见 `docs/superpowers/specs/2026-08-03-video-tagger-anime-tiered-design.md`。
