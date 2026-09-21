# 导出任务持久化（本期）— 执行计划

- **上游规格**：`docs/superpowers/specs/2026-09-21-export-task-persistence-design.md`（2026-09-21 用户批准）
- **状态**：本期（持久化）已实现并验证；下期（分块续渲）也已实现，**Java 端循环待真跑验证**（见 worklog 2026-09-21 增量二）
- **范围**：持久化 / 取消 / 启动接管 / 孤儿清理。**不含**分块续渲（下期）

## 步骤与验收

| # | 步骤 | 验收 |
|---|---|---|
| 1 | Flyway `V10__video_export_task.sql` + 实体 `ExportTaskRow` + `VideoExportTaskMapper` | 迁移在真库跑过；CRUD IT 通过 |
| 2 | `VideoExportTaskService` 写库化（create→insert / runAsync→RUNNING→DONE\|ERROR / 节流 / cancel / delete+清目录） | 单测：状态迁移、节流（10s 或 1%）、cancel 只对 RUNNING 生效 |
| 3 | `RecommendVideoService`：工作目录改持久位置（`data/exports/.work/<id>`）+ 新增回调（pid / progress） | 编译通过；正常导出仍出片 |
| 4 | `ExportTaskRecovery`（ApplicationReadyEvent）：RUNNING→INTERRUPTED + 杀 child_pid + 清无主 `.work/*` | 手工：重启后状态变 INTERRUPTED，遗留 node 被杀 |
| 5 | 端点 `POST …/tasks/{id}/cancel`；`DELETE` 改「删除+清理」；list 读库 | curl 验证 |
| 6 | 编辑器 `TaskPanel`：中断/取消态样式、取消按钮、删除文案 | typecheck + build:editor |
| 7 | 手工验收（规格 §9 六条）+ 工作日志 | 逐条记录实测 |

## 已知取舍

- 队列保持串行；`VideoExportTask` record 继续当 **API DTO**（形状不变，测试不用大改），DB 用新实体。
- 删任务只删行 + `.work` 目录，**从不碰 `data/exports/` 成品**。
- 杀 pid 前校验进程名含 `node`（Windows pid 复用风险）。
