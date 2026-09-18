# v0.28 推荐工作台（Remotion 原生编辑器化）执行计划

- **日期**：2026-09-18
- **设计规格**：`docs/superpowers/specs/2026-09-18-video-tagger-v028-recommend-editor-design.md`
- **状态**：**四个阶段已全部执行完成**（2026-09-18）。规格已批准（2026-09-18），装载方式按 **A 单页挂载**（§16-1 已裁）。阶段 2/3/4 的完成说明与实测证据见 `docs/worklog/2026-09-18.md` 增量七；阶段 1 见增量六。
- **依据**：同日五轮 Grilling 的 24 项决策（规格 §2）+ 两组实测探针（规格 §3.2）。

## 前置约束（执行期不得违反）

1. 只动推荐向导；`single-preview`（高光项目）、媒体库、高光项目不动。
2. 保留 `#titlebar/.sidebar/.statusbar/.container` 四容器。
3. 每阶段结束**都能正常用**；旧四步向导在**阶段 1 末**退役，不留开关、不留双轨。
4. 不兼容旧草稿/模板：V34 迁移重建两表并清旧行，不写兼容读取分支。
5. 门禁不假装覆盖：真实音频断言列「待素材」。
6. 后端改动需用户在 IDEA **Build + 重启**后生效（环境事实）；静态资源改完需 `cp` 到 `target/classes`。
7. 不新增依赖（`@remotion/player` 已在用；编辑器沿用 `vite` + `tsx`）。

---

## 阶段 1：会话与即时预览（旧 preview 退役）—— **已执行完成**（2026-09-18）

| # | 任务 | 状态 |
|---|---|---|
| 1.1 | 编辑会话服务 | ✅ `RecommendSessionService`（token 生命周期 + 超期清理 + BGM 落盘） |
| 1.2 | 会话端点 | ✅ `POST /session`、`POST /session/{token}/render-input`（**与原计划的差异：assets 合并进此端点**）、`DELETE /session/{token}` |
| 1.3 | 片段素材混合策略 | ✅ 实现 + 3 例单测；⚠️ 真实素材端到端未验（无 READY 产物、`data/videos` 空） |
| 1.4 | 编辑器构建与挂载（方式 A） | ✅ `vite.editor.config.ts` + `editor/` + `build:editor` + `/recommend-editor/**` + app.js 挂载/卸载 |
| 1.5 | Player 常驻 + 即时生效 | ✅ 本地参数补丁（实测 14ms）；⚠️ 帧溢出校正待人工验收 |
| 1.6 | 旧预览链路退役 | ✅ `/preview`、`dist-player`、`vite.player.config.ts`、`src/player.tsx`、`player.html`、`/recommend-player/**`、`hasPlayerBundle/playerPagePath` 均已删（另删 dev 入口 `scripts/serve-player.ts` + 根 `index.html`） |
| 1.7 | 顺带修 ②③④ | ✅ 超时死代码（渲染 + 探测）、孤儿端点、总时长死链路 |
| 1.8 | 探针脚本入册 | ✅ `probe:player` / `probe:cost` |

**阶段 1 门禁结果**：`tsc` ✅／`vitest` 26 ✅／`check:native` ✅／`verify:params` 38-0-0-0 ✅／`build:editor` ✅／`mvn test` 367 ✅／隔离实例会话端到端 ✅（含一次 390 帧精确匹配的导出）。详见 worklog 增量六。

---

## 阶段 2：时间轴

| # | 任务 | 产物 / 文件 | 验收 |
|---|---|---|---|
| 2.1 | 段模型本地计算 | `editor/` 内用 `buildScenePlan()`；建 `mediaId→media` 映射并索引化每帧查找（规格 §2-24） | 300 部规模下参数改动无卡顿（主观 + 计时） |
| 2.2 | 游标与时间码 | 订阅 `frameupdate` / `seeked`，显示帧/时间码/当前段 | 播放时游标连续 |
| 2.3 | 跳段双向联动 | 点段 → `seekTo(fromFrame)` + Inspector 切对象；点 Player 内卡片 → 定位段 | 双向跳转正确（含 `MEDIA_GRID` / `MEDIA_CLIP`） |
| 2.4 | 范围预览 | `inFrame/outFrame`（**行为未实测，先验证**：与 seek/播放/loop 的交互） | 只看本段循环；退出回全片；异常记录并采用备选（仅 seek + 自动停） |
| 2.5 | 段级标记 | Java `missing` 清单 + 本地检查（封面缺失/分组兜底/段长越界）→ 段上标黄 + 悬停原因 | 造缺片段场景：标黄与原因正确 |
| 2.6 | 缩略图 | **先探针** `Thumbnail` 单张耗时 → 懒加载（可视区±邻段）+ 串行队列 + 会话缓存；失败回落段色 | 耗时回填规格 §13.2；不阻塞交互 |

**阶段 2 门禁**：`verify:params` 全绿（含多帧确定性）+ 人工跳段/范围预览验收。

---

## 阶段 3：对象轴 Inspector + 主题 + 就地编辑

| # | 任务 | 产物 / 文件 | 验收 |
|---|---|---|---|
| 3.1 | Inspector 对象轴重排 | 全局 / 当前媒体 / 当前片段 / 当前段；高频首屏、一次性参数入「高级」折叠（参数表见规格 §6.3） | 参数可达性与归属自审 + 你验收 |
| 3.2 | 主题预设 | `theme.ts` 令牌化扩展 + 3~5 套预设（**含 1 套 = 现状 chapter**）；切换即画面变化 | 先出 3 张静态样张（`renderStill`）给你挑，再定令牌 |
| 3.3 | 就地编辑 | BGM 条浮层拖拽/缩放（回写 `bgmX/bgmY/bgmScale`）、左栏拖拽排序（= `order`）、开场槽位（= `openingIds`）；**浮层不进成片** | 拖拽后渲染产物无浮层残留（对比 `renderStill`） |
| 3.4 | 顺带修 ① + 门禁扩项 | `render-recommend.ts` 加 `colorSpace: 'bt709'`；`verify:params` 增**色彩标注断言**与**热更新保帧回归断言** | `ffmpeg -i` 断言 `yuv420p(tv, bt709)`；两条新断言全绿 |

**阶段 3 门禁**：`verify:params`（含新断言）+ 渲染抽帧目视 + 主题样张你签字。

---

## 阶段 4：系列化与变体

| # | 任务 | 产物 / 文件 | 验收 |
|---|---|---|---|
| 4.1 | V34 迁移 | 重建 `recommend_draft` / `recommend_template`（新 JSON 结构）+ 清旧行，同一迁移内完成 | 迁移可用；旧行已清；无兼容分支 |
| 4.2 | 模板模型 | `模板 = 配置 + 候选筛选条件 + 变体[]`；`RecommendPresetService` 与前端契约同步 | 单测：序列化/反序列化往返 |
| 4.3 | 候选重算 | 套用模板 → 按筛选条件（标签/年份/来源/入库时间范围）重算候选 + 人工微调 | 换批媒体重出：套模板后候选自动变、仍可手改 |
| 4.4 | 多版本导出 | 变体 = 具名覆盖（时长档/画幅/形态/每屏）；**前端按变体循环调用现有 `/video`**（后端签名不变）→ 队列 N 条任务 | 同配置导出 2 个版本，产物命名不冲突 |
| 4.5 | 保存策略 | 会话暂存节流（~1s 防抖）写草稿；模板显式命名保存；失败态显示"未保存"+重试 | 断网/异常下不丢工作；模板不被静默覆盖 |

**阶段 4 门禁**：模板往返、候选重算、多版本导出、草稿节流各一条实测证据。

---

## 全局验收命令（每阶段至少跑一次相关子集）

```bash
# Remotion 侧
cd backend/remotion
npx tsc --noEmit && npx vitest run && node scripts/check-native.mjs
npm run verify:params -- --scale 0.4
npm run probe:player && npm run probe:cost
npm run build:editor

# Java 侧
cd backend && mvn -o test

# 隔离实例（cwd 必须是项目根，否则落 data 目录错位）
VT_DATA_DIR=<副本> nohup mvn -q -o spring-boot:run -Dspring-boot.run.arguments=--server.port=18099 \
  -Dspring-boot.run.workingDirectory=D:/learn/myLearn/video-tagger

# 产物断言
ffmpeg -hide_banner -i "data/exports/<产物>.mp4" | grep Stream   # 期望 yuv420p(tv, bt709)
```

生产实例（8080，IDEA）验收由你 Build + 重启后进行。

---

## 待素材项（明确不覆盖）

**真实音频断言**（ducking 听感/静音段/增益曲线解码验证）依赖真实片段素材（本机 `data/videos` 为空、现有 clips 为 `REFERENCE_ONLY`）。**触发条件**：拿到真实片段素材后；**验法**：导出后用 ffmpeg 解码音轨，断言①有原声段非静音 ②ducking 段增益低于基准 ③无原声段无片段音轨。在此之前**不声称已覆盖**。

---

## 需要偏离规格的地方（先声明，完成后写进 worklog）

- 暂无。执行中若偏离，先在此声明再实施。

---

## 回滚与提交

- **提交粒度**：每阶段一次提交（信息含阶段名 + 阶段门禁证据摘要）；如你要求改粒度，按你的指示。阶段 1 之后旧向导已删除，回滚依赖 git 提交历史。
- **文档同步**：每阶段收尾更新 `docs/worklog/2026-09-18.md`（或当日文件）增量；规格状态（待批准 → 已批准 → 实现中 → 已实现）同步；版本收尾时 `CHANGELOG.md` / `docs/story.md` / `pom.xml`（0.28.0）。

---

## 版本关系

- v0.28：推荐工作台（编辑器化）+ 配置模型重建 + 旧链路清理 + 4 项既有缺陷修复。
- 不覆盖 v0.27 遗留：1080P/4K 耗时未测、Remotion 许可证未核验（沿用规格 §15 记录，不假装解决）。
