# SQLite schema 迁移脚本（桌面版）

桌面版（SQLite）的 schema 版本迁移，机制见 `SqliteSchemaMigrator`：
- 版本号存 SQLite 内建 `PRAGMA user_version`（读：`PRAGMA user_version`；写：`PRAGMA user_version = N`）
- **最新版本 = max(1, 本目录里最大的 `vNN.sql` 编号)**，基线 v1 = `sqlite-schema.sql` 当前结构
- 启动时：`user_version` 为 0（全新库或首次部署）→ 直接初始化为最新；`0 < 当前 < 最新` → 按序执行 `vNN.sql`，每个执行后递增 user_version

## 何时加迁移

**给已有表加列 / 改列类型 / 改默认值 / 数据回填 / 重命名**等，`sqlite-schema.sql` 的
`CREATE TABLE IF NOT EXISTS` 对已存在表整体跳过、救不了——必须加一个 `vNN.sql`。

**新增表 / 新增索引**：直接改 `sqlite-schema.sql` 加 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` 即可，**不需要**迁移脚本（幂等建表自动覆盖新装与老库）。

## 约定

- 文件命名：`v02.sql`、`v03.sql`…（**两位对齐**，编号递增，只增不改、不删）
- 内容：纯 SQLite **ALTER 语句**，可多条，`;` 分隔（由 Spring ScriptUtils 分割逐条执行）
- 注释行 `--` 允许；编码 UTF-8（ScriptUtils 已指定）
- 每条迁移**只针对上一个版本 → 当前版本**的增量改动，不写幂等保护（迁移器保证按序只跑一次）
- 若一次迁移涉及多条不可逆操作，先备份数据目录再升级（单用户本地工具，重装不贵）

## 示例

```sql
-- v02.sql：给片段表加「起止时间」
ALTER TABLE clip ADD COLUMN start_sec DOUBLE;
ALTER TABLE clip ADD COLUMN end_sec DOUBLE;
```

对应地，`SqliteSchemaMigrator` 会自动把最新版本从 v1 升到 v2，老用户启动时执行本脚本、新装用户建全表后直接标记 v2。
