# Video Tagger

网页视频片段打标签 + 自然语言搜索 + 一键回看的本地工具。

## 快速开始

前置：Docker Desktop（Windows）。

```powershell
git clone <repo> video-tagger
cd video-tagger
copy .env.example .env   # 可选：填入 Embedding API 配置以启用语义搜索
docker compose up -d
```

1. 浏览器 `chrome://extensions` → 开发者模式 → 加载已解压扩展 → 选择 `extension/` 目录。
2. 打开 `http://localhost:8080` 进入搜索页。
3. 看视频时按 `Alt+S` 打标签；在搜索页用自然语言检索，点击结果自动跳转到对应片段。

## 常用命令

```powershell
docker compose up -d        # 启动全栈
docker compose down         # 停止（数据保留在卷中）
docker compose logs -f app  # 查看后端日志
```

## 开发

```powershell
docker compose up -d mysql etcd minio milvus   # 仅起基础设施
mvn -f backend/pom.xml spring-boot:run         # 本地跑后端
mvn -f backend/pom.xml test                    # 跑测试（需 Docker 运行中，Testcontainers）
```
