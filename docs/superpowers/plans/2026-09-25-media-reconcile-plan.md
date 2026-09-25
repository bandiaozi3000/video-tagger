# 执行计划：媒体库对账（关联 / 合并 / 清理）+ 可复用脚本 + 「全量同步」入口

- 对应规格：`docs/superpowers/specs/2026-09-25-media-reconcile-design.md`（已拍板）
- 状态：**待用户确认后开工**
- 备份：`data/backup/video_tagger_pre-purge_20260925_015334.sql`（12MB，已验证可完整还原，38 表零差异）

---

## 0. 硬约束（每阶段都适用）

1. **只扫未关联 media**；已关联的 330 条**一律不动**（除删本地封面文件）。
2. 判定用「**名字/别名精确相等**」，不用旧的 `matchType=EXTERNAL_ID` 信号。
3. **同步/删除永不 abort 在飞的写请求**，只在**批次边界**停（沿用既有约定）。
4. **先干跑、后执行**：`live` 必须先跑过同口径 `dryRun`，且要确认词。
5. 每阶段结束跑 `mvn -o test`（当前基线 **446 / 0 / 0**）。
6. 涉及真库写操作的阶段，**一律先在副本库演练**（`video_tagger_uicheck` 套路：空库 + Flyway 自建，**不灌 dump**）。

---

## P0 · 安全网（收尾）

| 项 | 做法 |
|---|---|
| DB 备份 | ✅ 已完成并验证 |
| 封面清单快照 | 导出 `(media_id, cover_path, 文件字节数)` 到 `data/backup/covers-manifest-<ts>.tsv`，删之前先留名单 |
| 副本库 | 复用 `video_tagger_purgecheck`（已是真库的完整还原），演练在它上面做 |

**完成标准**：manifest 行数与 `select count(*) from media where cover_path is not null` 一致。

---

## P1 · 对账核心（纯只读，可独立验证）

**新增**
- `metadata/TitleNormalizer`：全角→半角、去标点/空格、`第N季`↔`第N部分`↔`篇/章`、中文数字→阿拉伯、大小写。
- `metadata/TitleSimilarity`：Levenshtein 比率。
- `service/reconcile/MediaReconcileMatcher`：给定本地 media → 候选列表 → 分层结论
  - 候选名集合 = `name_cn` + `name` + `nativeTitle` + **`aliases`（infobox 别名）**
  - `exact` = 归一化后相等；`near` = 相似度 ≥0.8
  - 多候选精确命中 → **年份 + 集数双重校验**消歧（拍板 1B）
- `service/reconcile/MediaReconcilePlanner`：把未关联 media 分成 ①②③④
  - ①② 再查 `external_work` 是否已有该 `external_id` → **MERGE** / **LINK**
- `service/reconcile/ReconcileReport`：可序列化的报告（含**每一条的判定与理由**）

**测试**（新增 `MediaReconcileMatcherTest` / `TitleNormalizerTest`）
- 用规格 §4.4 的 40 条真实样本做**离线夹具**（打进测试资源，不联网）：
  - 「描绘直至生命尽头」必须命中 `画完这个再去死`（**别名**路径）
  - 「轻松熊」必须命中「轻松熊」，**不得**命中「摇曳百合」
  - 「北斗神拳 拳王军杂兵们的挽歌」必须命中**同名**，不得命中「…第二季」
  - 「斗球儿弹子 → 斗球儿弹平」(0.80) 必须落 **②（人工）**，不得自动
- 年份/集数消歧：同系列多季样本必须选对季

**完成标准**：单测全过；跑一遍全库 5313 条**只读**产出报告，与规格预估对得上（①≈1340 ±30%）。

**证据**：报告文件 + 各层计数 + 随机 20 条人工核对记录。

---

## P2 · 动作执行（干跑 / live 同一套代码）

**新增 `service/reconcile/MediaReconcileExecutor`**，按层分派：

### P2.1 LINK
- 建 `external_work`（provider=BANGUMI, external_id, media_id=A）+ 拉详情/集/关联（复用 `MetadataSyncService` 既有写入路径，**不新写一套**）
- **不碰** `media` 的标题/年份/备注/评分/状态/标签（沿用 §16「不动本地数据」）

### P2.2 MERGE（A → B）
按规格 §6.1，**以本地为主**（A 的值优先）：

| 数据 | 动作 | 冲突 |
|---|---|---|
| `media_collection` | `media_id` 改指 B | 目标已在同一收藏夹 → 跳过并计数 |
| `media_tag` | 同上 | 同上 |
| `title_mapping` / `highlight_project` | 改指 B | 冲突 → 进报告，不自动 |
| `episode` | 改 `media_id` + `media_entry_id` | 目标已有同集号 → 进报告，不自动 |
| `note`/`rating`/`aliases`/`subcategory_id`/`season`/`allow_hardsub` | A 非空/非默认 → 覆盖 B | **逐字段写入 `overwritten[]` 报告** |
| `cover_path` | 不搬 | — |
| `media_entry`(A) | 删除 | — |
| A 本身 | **物理删** | — |

### P2.3 PURGE
- 先跑 7 条链路的**引用检查**（`clips`→`episode`、`video_asset`、`video_source_package`、`highlight_project`、`recommend_draft.config.ids`、`title_mapping`、`media_collection`/`media_tag`）
- **有引用 → 拒绝删并进报告**（④ 按定义应无引用，出现即视为异常）
- 删 `media_entry` + `media` + 封面文件（只删 `cover_path` 指向的那个具体文件）

### P2.4 封面清理
- 删：①（合并后 A 的）、④（被删的）、已关联 186 条
- **暂留**：②③（默认，见规格 §6.5 的显式开关）
- **绝不动的目录**：`covers/clip/`、`covers/ep/`、`covers/ext/`

**完成标准**：`dryRun` 报告里每条动作都有「做什么 + 为什么」；`live` 与 `dryRun` 计数**逐层一致**。

---

## P3 · 任务与接口

**V39 迁移**（MySQL Flyway；SQLite 侧按 §13 冻结不动）
```sql
CREATE TABLE media_reconcile_job (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mode VARCHAR(16) NOT NULL,          -- dry | live
  status VARCHAR(16) NOT NULL,        -- PENDING|RUNNING|DONE|FAILED|CANCELLED|INTERRUPTED
  phase VARCHAR(32),
  total INT, done INT,
  linked INT, merged INT, purged INT, skipped INT, failed INT,
  message VARCHAR(1000),
  detail_json LONGTEXT,
  confirm_token VARCHAR(64),          -- live 的确认词校验
  started_at BIGINT, finished_at BIGINT, updated_at BIGINT
);
```

**新增**
- `service/reconcile/MediaReconcileJobService`：`@Async` 跑、分批（每批 20 条一事务）、批次边界可取消
- `config/MediaReconcileRecovery`：启动把 `RUNNING` 标 `INTERRUPTED`（照 `ExportTaskRecovery`）
- `controller/MediaReconcileController`（`/api/media/reconcile`）
  - `POST /plan` 干跑（同步执行，只读）
  - `POST /start` 起任务（`dryRun` / `live` + `confirmToken`）
  - `GET /job/{id}` / `GET /job/latest` 进度与结果
  - `POST /job/{id}/cancel` 取消

**完成标准**：`MediaReconcileJobServiceTest` + `ControllerTest` 覆盖：建任务、进度递增、取消在批次边界停、重启接管标 INTERRUPTED、`live` 缺确认词 → 400。

---

## P4 · 前端入口（同步弹窗 + 进度）

- `index.html`：「同步番剧」弹窗底部加 **「全量同步（对账）」** 按钮 + 执行前的确认（输入确认词）
- `bgm-sync.js`：复用既有 **`#bgm-sync-float` pill** 显示对账进度；点它回到弹窗；完成结果落进**「上次同步」**式持久化块（`localStorage`）
- 干跑报告：弹窗内可查看分层计数（①/②/③/④），并提供 **CSV 下载**（②③ 的人工清单）

**完成标准**：浏览器实测（agent-browser）—— 起任务 → pill 显示进度 → 关闭弹窗后仍跑 → 点 pill 回来看进度 → 完成后结果可查。

---

## P5 · 封面链反转（本地优先）

**改 4 处实现**（规格 §6.5）
- `static/app.js`：`mediaCoverSources` / `mediaCoverSrc` / `mediaCoverAttrs`（三处调用点）
- `editor/panes.tsx`
- `RecommendService.resolveCover`
- `RecommendSingleService.firstCover`

**同步文档**
- `AGENTS.md` §3 的封面链描述
- `docs/rules.md` §16（或封面专条）

**不改**：`CoverService.ensureExternalCover` 的写入行为（本来就写 `covers/ext/` 且不写 DB）

**完成标准**：单测/构建过；浏览器抽查：有本地封面的显示本地、没有的显示 Bangumi、都没有的退片段帧。

---

## P6 · 演练 → 真库执行（**分两次，中间等你确认**）

### P6.1 副本库全流程（不碰真库）
1. `plan` 只读报告 → 与 P1 一致
2. `live` 全流程跑完
3. **幂等**：再跑一次，变更必须为 **0**
4. **悬空引用检查**：7 条链路全部无指向已删 media 的孤儿
5. 副本库计数比对 + 抽样人工核对（① 随机 30 条）

### P6.2 真库（**要你点头两次**）
1. 先 `dryRun` 出报告 → **给你看**（尤其「以本地为主」会覆盖多少条 `note`）
2. 你确认后才 `live`

**回滚**：真库出问题 → 用 `data/backup/video_tagger_pre-purge_20260925_015334.sql` 还原（已验证）。
> 注意：还原会丢掉执行后新产生的数据；且该 dump **不含** `covers/` 文件（全删才有 5.5G）。若需回滚封面，靠 P0 的 manifest 重新下载（但 ②③ 的 AniList/omofuna 源图**无法重抓**）。

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 误合并（把不同作品并成一条） | 精确匹配 + 年份/集数双重校验；0.8–0.95 一律走人工 |
| 误删（④ 判定错） | ④ 必须**先过 7 条引用检查**，有引用就拒绝删 |
| 「以本地为主」覆盖掉已关联那条的备注 | `dryRun` **逐字段列出覆盖**；真库执行前你看报告 |
| 封面误删片段/单集封面 | 只删 DB `cover_path` 指向的具体文件，不扫目录；`clip/`/`ep/`/`ext/` 不碰 |
| 长任务中断 | 任务表持久化 + 批次边界可取消 + 重启接管标 INTERRUPTED |
| Bangumi 限流/封禁 | 沿用既有 150ms 间隔 + 3 次重试；分批 + 可取消 |
| ID 撞车（media/clip/episode 同号） | 已实测：三类分属不同目录，不撞 |

---

## 阶段产出与估时

| 阶段 | 产出 | 估时 |
|---|---|---|
| P0 | manifest 快照 | 0.3h |
| P1 | 匹配器 + 分层器 + 单测 + 全库只读报告 | 3h |
| P2 | 执行器（LINK/MERGE/PURGE/封面）+ 干跑 | 4h |
| P3 | V39 + 任务服务 + 4 接口 + 单测 | 3.5h |
| P4 | 前端按钮 + pill 进度 + CSV | 2.5h |
| P5 | 封面链反转 4 处 + 文档 | 1.5h |
| P6 | 副本演练 + 真库执行 | 3h |
| | **合计** | **≈ 17.8h** |
