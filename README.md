# Video Tagger

网页视频片段打标签 + 自然语言搜索 + 一键回看的本地私有化工具（Java + Spring Boot + MySQL + Milvus + 浏览器扩展）。

在 B站 / YouTube 等任意含 `<video>` 的网页看片时，按 `Alt+S` 打标签；之后在 Web UI 里用自然语言搜索、按视频时间线回顾，点击结果一键跳回对应片段。

## 功能

- **秒级打标**：`Alt+S` 弹浮层；`Ctrl+Shift+1~9` 快捷标签位（可静默直存）；连续打标模式时间戳实时跟随；标签输入自动补全。
- **重复片段提示**：同一片段已存过时提示，可"追加标签"合并或"仍然新增"。
- **混合语义搜索**：MySQL ngram 全文 + Milvus 向量召回 + RRF 融合；未配置 Embedding API 时自动降级为纯关键词。
- **视频时间线**：同一视频的所有标记点沿时间轴排布，点击即跳回；分 P 视频正确聚合。
- **相似片段推荐**：同标签优先 + 向量近邻，顺藤摸瓜找一筐。
- **标签管理**：Web UI 里编辑 / 删除 / 追加标签。
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

- 后端：`POST /api/clips`（保存）、`PUT/DELETE /api/clips/{id}`（编辑/删除/追加）、`GET /api/search`（混合检索）、`GET /api/search/similar`（相似推荐）、`GET /api/videos` + `GET /api/videos/{fp}/clips`（时间线）、`GET /api/stats`（统计）、`GET /api/tags`（补全）、`GET /api/clips/near`（邻近提示）、跳转队列。
- 存储：MySQL（标签与全文索引）+ Milvus（向量）+ Flyway 迁移。
- 扩展：Manifest V3，Shadow DOM 浮层，background 转发后端请求。
- 文档：功能深化设计见 `docs/superpowers/specs/2026-08-02-video-tagger-enhancement-design.md`，实施计划见 `docs/superpowers/plans/2026-08-02-video-tagger-enhancement-plan.md`。
