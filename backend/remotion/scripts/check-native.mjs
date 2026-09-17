/**
 * Remotion 原生硬禁则门禁（设计规格 §12.1 + §12 第 10 条）。
 *
 * 为什么是硬门禁：Remotion 逐帧渲染时帧可能乱序或重复，CSS 过渡/关键帧、定时器、
 * `Math.random` 的状态取决于浏览器实时时钟或运行时刻，不由帧号决定 → 会闪烁、进度错乱，
 * 且**同一输入两次渲染结果不一致**。这些东西一旦漏回源码，"可复现"就不成立。
 *
 * 用法：node scripts/check-native.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'src');
const FORBIDDEN = [
  { pattern: /\btransition\s*:/, hint: 'CSS transition（改用 interpolate/spring）' },
  { pattern: /\banimation(-[a-z]+)?\s*:/, hint: 'CSS animation（改用 interpolate/spring）' },
  { pattern: /@keyframes/, hint: 'CSS 关键帧（改用 interpolate/spring）' },
  { pattern: /\bsetTimeout\s*\(/, hint: '定时器（改用 useCurrentFrame）' },
  { pattern: /\bsetInterval\s*\(/, hint: '定时器（改用 useCurrentFrame）' },
  { pattern: /\brequestAnimationFrame\s*\(/, hint: 'rAF（改用 useCurrentFrame）' },
  { pattern: /Math\.random\s*\(/, hint: '非确定性随机（改用 remotion 的 random(seed)）' },
];

/** 去掉注释行，避免文档里提到这些名字时误报。 */
function stripCommentLines(source) {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !(trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'));
    })
    .join('\n');
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const violations = [];
for (const file of walk(root)) {
  const source = stripCommentLines(fs.readFileSync(file, 'utf8'));
  source.split('\n').forEach((line, index) => {
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(line)) {
        violations.push({ file: path.relative(process.cwd(), file), line: index + 1, code: line.trim(), hint: rule.hint });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('❌ 违反 Remotion 原生硬禁则：');
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.code}\n      → ${v.hint}`);
  process.exit(1);
}
console.log(`✅ 硬禁则通过：${walk(root).length} 个源文件，无 transition/animation/@keyframes/定时器/Math.random`);
