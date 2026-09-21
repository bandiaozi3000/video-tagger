# 导出任务持久化 + 可中断续渲（本期：持久化 / 取消 / 孤儿清理）— 设计规格

- **版本**：v0.29.x（暂记）
- **日期**：2026-09-21
- **状态**：待用户批准
- **上游**：本规格只覆盖**本期**；分块续渲为下期，见 §11

---

## 1. 需求与实测依据

### 1.1 用户诉求（2026-09-21 原话）

> 当前任务纯内存的，重启就消息（丢失）。能持久化任务，且做到支持暂停，关闭，异常的话从上次渲染进度重新渲染吗？

并按推荐的 8 条决策拍板：

| # | 决策 | 采纳值 |
|---|---|---|
| Q1 | 任务存哪 | **MySQL 新表**（不选 JSON 文件） |
| Q2 | 暂停粒度 / 块大小 | **块边界停**；块 = **2 分钟成片**（24fps ≈ 2900 帧） |
| Q3 | 重启后 RUNNING 的语义 | **标记「已中断 · 可继续」**，不自动续渲 |
| Q4 | 块失败重试 | **自动重试 1 次**，再失败停下等人工 |
| Q5 | 片段素材缓存进任务目录 | **要** |
| Q6 | 暂停 / 删除分开 | **分开**（删除连带清理工作目录） |
| Q7 | 出片后清理块目录 | **自动清理**（成功且产物就位后） |
| Q8 | 分期还是一次做完 | **甲：先持久化，分块续渲下期** |

### 1.2 关键技术事实（实测，不是推断）

1. **任务状态确实纯内存**：`VideoExportTaskService` 用 `ConcurrentHashMap<Long, VideoExportTask>` + `AtomicLong seq` →
   重启即丢；`data/exports/` 目录**至今 0 个产物**（4K 超时、12:35 那次被重启中断）。
2. **Remotion 没有「暂停」**：`@remotion/renderer/dist/index.d.ts` 里只有
   `frameRange`（分段渲染）、`cancelSignal` / `makeCancelSignal`（取消）、`forSeamlessAacConcatenation`（为**无缝拼接 AAC** 而设）。
   → 暂停 / 续渲 / 断点恢复**只能是同一个机制**：分块渲染 + 拼接（下期）。
3. **已有孤儿**：`%TEMP%/vt-recommend-13645075758271294060`（12:35，`render-input.json` 在、无产物）→
   后端重启**既不杀 node 子进程、也不清工作目录**（`deleteTree` 只跑在正常路径的 `finally`）。
4. **进度上报已通**（增量四十四修好接线）：渲染脚本每 ~4s 打一行 JSON，Java 按行解析写入任务。

### 1.3 本期范围（用户已确认）

- 任务**持久化**（跨后端重启可查、可续看）
- 运行中任务的**取消**（= 「关闭」；杀子进程 + 标记 CANCELLED）
- **启动接管**：库里遗留的 `RUNNING` → `INTERRUPTED`（不假装还在跑）
- **清理**：杀遗留子进程 + 清无主工作目录

---

## 2. 非目标（本期明确不做）

- **暂停 / 继续 / 断点续渲**（下期 §11；本期只把续渲需要的字段先落库，不消费）
- 导出并发（**保持串行**：块化后并行只会互抢 CPU）
- 素材准备阶段的进度（下期与分块一起做）
- SQLite 侧同步（桌面轨道已冻结）
- 老的内存任务迁移（重启即丢，不做兼容层，README/日志里说明一句即可）

---

## 3. 现状约束

| 位置 | 现状 | 本期要动的地方 |
|---|---|---|
| `VideoExportTaskService` | 内存 Map + 自增 id | 换成 MySQL 表；id 交给自增主键 |
| `VideoExportTask` record | 9 字段 | 扩成表实体（保留兼容构造，避免测试大改） |
| `RecommendVideoService.render` | 建临时目录 → 跑 node → 挪产物 → `finally deleteTree` | 工作目录改成**持久位置**并记录到任务行 |
| 队列 | `videoExportExecutor` 单线程串行 | 不动 |
| 任务 API | list / get / delete / open | `delete` 语义改成"删除 + 清理目录"；新增 `cancel` |

---

## 4. 数据模型（Flyway `V10__video_export_task.sql`）

```sql
CREATE TABLE video_export_task (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    title         VARCHAR(200) NOT NULL,
    media_count   INT          NOT NULL DEFAULT 0,
    status        VARCHAR(16)  NOT NULL,          -- PENDING/RUNNING/DONE/ERROR/CANCELLED/INTERRUPTED
    message       VARCHAR(2000) NULL,
    file_path     VARCHAR(500) NULL,
    format        VARCHAR(8)   NULL,
    progress      INT          NOT NULL DEFAULT 0,
    work_dir      VARCHAR(500) NULL,              -- 工作目录（下期续渲入口）
    child_pid     BIGINT       NULL,              -- 渲染子进程 pid（本期用于杀遗留）
    request_json  MEDIUMTEXT   NULL,              -- 请求快照（**剥掉 base64**；下期续渲用）
    created_at    BIGINT       NOT NULL,
    started_at    BIGINT       NULL,
    finished_at   BIGINT       NULL,
    updated_at    BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**状态机**：

```
PENDING ──claim──► RUNNING ──ok──► DONE
                     │  ├─fail────────► ERROR
                     │  ├─cancel──────► CANCELLED
                     │  └─进程死/重启──► INTERRUPTED   （下期：可 ──resume──► RUNNING）
```

- 下期新增 `PAUSED`；本期不出现。
- `message` 存中断/失败原因（如"后端重启中断（12:35）"）。
- `request_json` 本期只**写入**不消费 —— 它让下期续渲不必再改表；体积控制：BGM/转场音只存**工作目录里的相对路径**，不存 base64（原始请求里那 43MB flac 转 base64 约 57MB，绝不能进库）。

---

## 5. 后端改动

### 5.1 `VideoExportTaskMapper`（MyBatis-Plus + `@Select`）

- `insert` / `updateStatus` / `updateProgress` / `findAll(limit)` / `findById` / `deleteById`
- `markRunningAsInterrupted(String reason)`：启动接管用（一条 UPDATE）

### 5.2 `VideoExportTaskService` 改造

- `create(...)`：先 `insert(PENDING)` → 立刻 `RUNNING`（写 `started_at`、`work_dir` 占位）；返回带 id 的任务
- `runAsync(...)`：
  - 启动 node 时把 `child_pid` 写库（`Process.pid()`）
  - 进度上报：**节流写库** —— 距上次写库 ≥ 10s 或百分比变化 ≥ 1 才 UPDATE（4s 一写对 5 小时的任务太吵）
  - 结束时 `updateStatus(DONE/ERROR, finished_at)`
- `cancel(id)`：只对 `RUNNING/PENDING` 生效 → `ProcessHandle.of(pid).destroy()`（失败降级 `destroyForcibly`）→ 标记 `CANCELLED`
- `delete(id)`：删行 + **清理 work_dir**（`deleteTree`）；正在跑的必须先 cancel

### 5.3 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/recommend/video/tasks/{id}/cancel` | 新增：取消运行中/排队中的任务 |
| DELETE | `/api/recommend/video/tasks/{id}` | 语义收紧：删行 + 清目录（运行中先拒绝，提示先取消） |
| GET | `/api/recommend/video/tasks` | 改读库（含 progress/finishedAt/status，形状向后兼容） |

### 5.4 启动接管 `ExportTaskRecovery`（`ApplicationReadyEvent`）

1. 库里 `RUNNING` → `INTERRUPTED`，`message = "后端重启中断"`；
2. 对每条的 `child_pid`：`ProcessHandle.of(pid)` 存活就 `destroyForcibly()` 并记日志（**治孤儿 node**）；
3. 扫工作目录根（`data/exports/.work/*`）：无对应 `work_dir` 的目录直接删（本期不支持续渲）；
4. 以上三步都**不抛异常**（失败只记 WARN，不影响启动）。

工作目录根从临时目录改成 `data/exports/.work/<taskId>/`：持久、可枚举、与产物同盘（移动/拼接不跨盘）。

---

## 6. 进度写库节流

- 渲染脚本仍 4s 一行（内存态 UI 用它更新，够快）；
- DB 侧：`lastWriteAt` + `lastPct` 双条件，10s 或 1% 才写；
- 结束时无条件写一次终值。

---

## 7. 编辑器改动（`TaskPanel`）

- 新状态样式：`INTERRUPTED`（琥珀）/ `CANCELLED`（灰）；`RUNNING` 保留进度条 + ETA；
- 每行加 **取消** 按钮（仅 RUNNING/PENDING）→ `api.cancelTask(id)`；
- 删除按钮文案改成「删除并清理」，RUNNING 时禁用并提示先取消；
- 重启后打开面板：历史任务仍在（含 `finishedAt` → 「共 x 分」）；
- 轮询仍是 3s（读库了，但一次列表查询很便宜）。

---

## 8. 边界与错误

| 情况 | 处理 |
|---|---|
| 杀进程失败（无权限/已退出） | 记 WARN，仍标 `CANCELLED`（用户要的结果是"停"） |
| DB 写失败 | 记 WARN，**不影响渲染**（内存态继续，UI 数据会旧） |
| 进度回退（多 chunk 重试场景，下期） | 只在增大时写 |
| `work_dir` 已被删/不存在 | 清理与删除都不报错（幂等） |
| pid 复用（Windows） | 只在启动接管时 kill，且**校验进程名含 node** 再杀 |

---

## 9. 验收口径

1. 起一个导出 → 重启后端 → 任务列表仍能看到该任务，状态 `INTERRUPTED`，`message` 有原因；
2. 重启后 `tasklist` 里不再有上次遗留的渲染 node（被接管杀掉）；
3. `data/exports/.work/` 不再堆积无主目录；
4. 运行中点「取消」→ 5s 内任务变 `CANCELLED`，node 进程消失，产物目录被保留（可人工看）；
5. 现有 `mvn -o test`（401）与 `npm test`（127）全绿，无回归；
6. 正常导出完成后：产物在 `data/exports/`，任务 `DONE`，`progress=100`。

---

## 10. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 写库频率拖慢渲染 | 节流（10s / 1%），且只 UPDATE 一行 |
| 启动接管误杀无关 pid | 校验进程名 + 只处理本表记录的 pid |
| 删除语义变化让用户误删产物 | 删除只删**任务行 + .work 目录**，从不碰 `data/exports/` 里的成品 |
| 回滚 | 代码回退即可；表保留（无写入方也不影响启动），不写 down migration |

---

## 11. 下期（分块渲染 / 暂停 / 续渲）预告

已确认的推荐值（供下期规格直接引用）：

- 块 = **2 分钟成片**（24fps ≈ 2900 帧）；`renderMedia({ frameRange, forSeamlessAacConcatenation: true })` 逐块出 mp4；
- 拼接：`ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4`（同 codec/参数 → 无重编码）；
- **先做 10 分钟 spike 验证无缝拼接**（含音画同步、分块边界无爆音），spike 通过才写实现；
- 暂停 = 当前块跑完即停（Q2）；失败自动重试 1 次（Q4）；
- 续渲入口 = 任务行里的 `work_dir` + `request_json`（本期已落库）→ 跳过已有块；
- 进度模型改成「已完成 3/16 块 · 当前块 45%」；
- 顺带把**素材准备进度**（`准备素材 i/N`）接上。

---

## 12. 交付顺序（批准后写进执行计划）

1. V10 迁移 + 实体/Mapper + 单测（CRUD + 状态迁移）
2. `VideoExportTaskService` 写库化 + 节流 + `cancel`
3. 工作目录改持久位置 + `deleteTree` 时机调整
4. `ExportTaskRecovery` 启动接管（中断标记 / 杀 pid / 清孤儿）
5. 端点 + 编辑器面板改造
6. 手工验收（§9 六条）+ 工作日志
