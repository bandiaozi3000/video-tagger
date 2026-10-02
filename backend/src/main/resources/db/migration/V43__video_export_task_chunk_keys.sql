-- 块键（2026-10-01 增量更新）：`[{"key":"sha256…","file":"绝对路径"}]`
--
-- 用途：点「增量更新」时按**内容键**比对上一轮与新一轮的分块，只重渲内容变了的块（其余复用旧产物），
-- 拼接后覆盖原成品。键由 TS 侧定义（`backend/remotion/src/chunk-keys.ts`：全局层 + 段层指纹），
-- Java 侧只负责装配成块键并比对（`ChunkKeys`）。
--
-- 老任务该列为 NULL → 调用方自动补算（对旧 render-input.json 再探一次帧）或退回整片重渲。
ALTER TABLE video_export_task ADD COLUMN chunk_keys TEXT NULL;
