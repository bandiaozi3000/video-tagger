# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格。

## [0.2.0] - 2026-08-02

### 新增
- **编辑 / 删除 / 追加标签**：Web UI 卡片可直接编辑与删除；重复片段提示支持"追加标签"合并到同一条。
- **连续打标模式**：保存后浮层不关，标签保持、时间戳跟随播放进度实时刷新，一集连标不碰键盘。
- **快捷标签位**：`Ctrl+Shift+1~9` 预填标签，可配静默直存（options 页配置）。
- **标签补全**：浮层输入时下拉已有高频标签。
- **重复片段提示**：同一视频 ±10s 内已存过则提示，可选择"追加标签 / 仍然新增"。
- **视频时间线视图**：按 URL 指纹聚合视频列表，点进单个视频看全部标记点沿时间轴排布，点击即跳回。
- **相似片段推荐**：每张卡片"相似"按钮，同标签优先 + 向量近邻顺藤摸瓜。
- **统计面板**：总量 / 视频数 / 标签数、Top 标签（可点击搜索）、站点分布、近 30 天趋势（原生 SVG）。

### 修复
- **Milvus 冷启动竞态**：compose 加 healthcheck，Milvus 晚于 app 就绪时 60 秒自动重连，语义搜索不再永久哑火。
- **3 秒去重静默吞数据**：误触判定改为"同 URL + 时间戳接近 + 标签相同"；同片段补不同标签走新建记录，扩展端提示"该片段刚已保存"。
- **密钥安全**：硬编码 Embedding Key 移出配置文件，仅从 `.env` 注入；后端默认绑定回环地址，Docker 端口仅发布到宿主机回环。
- Milvus 连接失败时关闭 gRPC channel，避免泄漏。

### 工程化
- 引入 **Flyway** 管理 schema 迁移（V1 基线 + V2 视频指纹）。
- 统一错误体 `{code, message}`（`@RestControllerAdvice`）。
- 输入校验增强（URL 格式、字段长度）。
- 新增 `GET /api/tags`、`GET /api/clips/near`、`GET /api/videos`、`GET /api/videos/{fp}/clips`、`GET /api/clips/{id}/similar`、`GET /api/stats`、`PUT/DELETE /api/clips/{id}`。

### 架构 / 数据
- `clips` 表新增 `video_fp`（URL 指纹，同一视频聚合）与 `video_duration`（可选）；历史数据启动时自动回填。
- 后端测试 46 → 60 个用例。
