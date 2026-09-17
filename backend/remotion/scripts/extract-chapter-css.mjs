/**
 * 从旧模板机械提取 CSS → `src/chapter/chapter.css`。
 *
 * 目的：Remotion 版的视觉与旧模板**同源**，不靠手抄（手抄必偏）。
 * 变换（仅此三处，其余逐字保留）：
 *   1. 删掉 `html{scroll-snap-type:...}`（Remotion 逐帧渲染无滚动容器）
 *   2. `body{` → `.vt-chapter-root{`（Remotion 里没有 body，改用根容器承载）
 *   3. `body::before` → `.vt-chapter-root::before`
 *
 * 重新生成：`node scripts/extract-chapter-css.mjs`
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(projectRoot, '..', '..');
const source = path.join(repoRoot, 'backend', 'src', 'main', 'resources', 'templates', 'recommend-chapter.html');
const target = path.join(projectRoot, 'src', 'chapter', 'chapter.css');

const html = await fs.readFile(source, 'utf8');
const open = html.indexOf('<style>');
const close = html.indexOf('</style>');
if (open < 0 || close < 0 || close < open) {
  throw new Error(`无法定位 <style> 块: ${source}（open=${open} close=${close}）`);
}

const raw = html.slice(open + '<style>'.length, close);
const css = raw
  .replace(/[ \t]*html\{scroll-snap-type:[^}]*\}\r?\n/, '')
  .replace(/(^|\n)([ \t]*)body\{/g, '$1$2.vt-chapter-root{')
  .replace(/(^|\n)([ \t]*)body::before\{/g, '$1$2.vt-chapter-root::before{');

if (/(^|[\s,>])body\s*[{:.]/.test(css)) {
  console.warn('⚠️ 仍有未替换的 body 选择器，请检查提取规则');
}

const banner = `/* 由 scripts/extract-chapter-css.mjs 从 templates/recommend-chapter.html 机械提取，请勿手改。
 * 源文件：backend/src/main/resources/templates/recommend-chapter.html
 * 变换：html{} 删除；body{} / body::before{} → .vt-chapter-root{} / .vt-chapter-root::before{}
 */
`;

await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, banner + css.trimStart());

// 同时产出 TS 字符串模块：Remotion/Vite 两端都不依赖 CSS loader，注入 <style> 即可
const tsTarget = path.join(projectRoot, 'src', 'chapter', 'chapter-css.ts');
await fs.writeFile(
  tsTarget,
  `// 自动生成（scripts/extract-chapter-css.mjs），请勿手改。\nexport const CHAPTER_CSS = ${JSON.stringify(banner + css.trimStart())};\n`,
);
const lines = css.split('\n').length;
console.log(`提取完成：${path.relative(projectRoot, target)}（${lines} 行，${Buffer.byteLength(css)} 字节）`);
console.log(`同时产出：${path.relative(projectRoot, tsTarget)}`);
