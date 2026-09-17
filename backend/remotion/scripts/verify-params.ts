/**
 * 参数生效验证：回答「Remotion 基础上能不能支持这些推荐模板参数」。
 *
 * 判定方式（不烧整片渲染）：同一帧、同一份输入，**只改一个参数**，各导一张 PNG。
 *   - 两次字节完全相同 ⇒ 参数未生效（缺承载它的场景结构，需结构移植）
 *   - 字节不同         ⇒ 参数生效（参数 → 画面 通道已打通）
 *
 * 另有「计划级」参数（时长/fps/分辨率）不走像素比对，直接断言 ScenePlan 与 Composition 配置变化。
 *
 * 用法：npm run verify:params [-- --input poc/real-input.json --scale 0.5 --only title,coverSize]
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { DEFAULT_PARAMS, NOT_CONSUMED_KEYS, type RenderParams } from '../src/params';
import { buildScenePlan } from '../src/scene-plan';
import type { MultiMediaPocInput, ScenePlan, SceneType } from '../src/types';
import { startAssetServer } from './asset-server';

const COMPOSITION_ID = 'MultiMediaRecommendPoc';
const projectRoot = path.resolve(import.meta.dirname, '..');
const pocRoot = path.join(projectRoot, 'poc');

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

interface Case {
  key: keyof RenderParams;
  desc: string;
  /** 画面比对用的帧由基线 ScenePlan 推出（场景中点，或场景起始后几帧） */
  frameOf: (plan: ScenePlan) => number;
  /** 基座参数：基线与变体都带上，用于制造「可观察前提」（如背景图存在才能观察旋转） */
  base?: Partial<RenderParams>;
  to: unknown;
}

const mid = (type: SceneType, nth = 0) => (plan: ScenePlan): number => sceneOf(plan, type, nth).fromFrame + Math.floor(sceneOf(plan, type, nth).durationInFrames / 2);
const early = (type: SceneType, offset = 5) => (plan: ScenePlan): number => sceneOf(plan, type, 0).fromFrame + offset;

function sceneOf(plan: ScenePlan, type: SceneType, nth: number) {
  const matched = plan.scenes.filter((scene) => scene.type === type);
  if (!matched[nth]) throw new Error(`场景不存在: ${type}[${nth}]`);
  return matched[nth];
}

function buildCases(firstId?: number, lastId?: number): Case[] {
  const one = (name: string) => ({ bgmTracks: [{ name }] });
  return [
    { key: 'title', desc: '主标题', frameOf: mid('COLLECTION_OPENING'), to: '参数验证标题' },
    { key: 'brandTitle', desc: '品牌标题', frameOf: mid('COLLECTION_OPENING'), to: 'BRAND VERIFY' },
    { key: 'subtitle', desc: '副标题', frameOf: mid('COLLECTION_OPENING'), to: '参数验证副标题' },
    { key: 'intro', desc: '序言正文', frameOf: mid('COLLECTION_INTRO'), to: '参数验证序言正文' },
    { key: 'prologueTitle', desc: '序言标题', frameOf: mid('COLLECTION_INTRO'), to: '参数验证序言标题' },
    { key: 'endingTitle', desc: '结尾标题', frameOf: mid('COLLECTION_ENDING'), to: '参数验证结尾标题' },
    { key: 'endingText', desc: '结尾文案', frameOf: mid('COLLECTION_ENDING'), to: '参数验证结尾文案' },
    { key: 'coverSize', desc: '封面尺寸', frameOf: mid('COLLECTION_OPENING'), to: 92 },
    { key: 'detailShow', desc: '详情状态行', frameOf: mid('MEDIA_INFO'), to: { status: false, note: true, tag: true } },
    { key: 'detailShow', desc: '详情标签区', frameOf: mid('MEDIA_INFO'), to: { status: true, note: true, tag: false } },
    { key: 'detailShow', desc: '片段备注', frameOf: mid('MEDIA_CLIP'), to: { status: true, note: false, tag: true } },
    { key: 'bgColor', desc: '背景底色', frameOf: mid('COLLECTION_OPENING'), to: '#3a1d5c' },
    { key: 'bgImages', desc: '背景图', frameOf: mid('COLLECTION_OPENING'), base: { bgColor: '#101010' }, to: ['media/poster-a.jpg'] },
    {
      key: 'bgRotationSec',
      desc: '背景轮播间隔',
      // 轮播在帧模型下是确定性的，必须选一个「两种间隔下索引必然不同」的帧：
      // 开场中点（frame 30）：默认 8s → floor(30/240)=0 → 图 A；变体 1s → floor(30/30)=1 → 1%3=1 → 图 B。
      frameOf: mid('COLLECTION_OPENING'),
      base: { bgColor: '#101010', bgImages: ['media/poster-a.jpg', 'media/poster-b.jpg', 'media/poster-c.jpg'] },
      to: 1,
    },
    { key: 'bgOpacity', desc: '背景不透明度', frameOf: mid('COLLECTION_OPENING'), base: { bgColor: '#000000', bgImages: ['media/poster-a.jpg'] }, to: 25 },
    { key: 'bgBlur', desc: '背景模糊', frameOf: mid('COLLECTION_OPENING'), base: { bgColor: '#000000', bgImages: ['media/poster-a.jpg'] }, to: 80 },
    { key: 'bgBrightness', desc: '背景亮度', frameOf: mid('COLLECTION_OPENING'), base: { bgColor: '#000000', bgImages: ['media/poster-a.jpg'] }, to: 100 },
    { key: 'bgmTracks', desc: 'BGM 曲目', frameOf: mid('COLLECTION_OPENING'), base: one('默认曲目'), to: [{ name: '参数验证曲目' }] },
    { key: 'bgmScale', desc: 'BGM 条缩放', frameOf: mid('COLLECTION_OPENING'), base: one('参数验证曲目'), to: 165 },
    { key: 'bgmX', desc: 'BGM 条水平位置', frameOf: mid('COLLECTION_OPENING'), base: one('参数验证曲目'), to: 45 },
    { key: 'bgmY', desc: 'BGM 条垂直位置', frameOf: mid('COLLECTION_OPENING'), base: one('参数验证曲目'), to: 30 },
    // 速度类需比对「入场动画区间内」的帧（中点已是终态，看不出差别）
    { key: 'openingSpeed', desc: '开场动效速度', frameOf: early('COLLECTION_OPENING'), to: 100 },
    { key: 'endingScrollSpeed', desc: '结尾动效速度', frameOf: early('COLLECTION_ENDING'), to: 100 },
    // 对比「全部封面显影」vs「只显影一个」：单个封面落在 SPOTS[0]（大多在画外）时差异极小，不宜作对比基线
    { key: 'openingIds', desc: '开场封面带取用', frameOf: mid('COLLECTION_OPENING'), base: { openingIds: [] }, to: firstId === undefined ? [] : [firstId] },
  ];
}

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function main(): Promise<void> {
  const inputPath = path.resolve(argument('--input') ?? path.join(pocRoot, 'real-input.json'));
  const scale = Number(argument('--scale') ?? '0.5');
  const only = argument('--only')?.split(',').map((v) => v.trim()).filter(Boolean);
  const outDir = path.resolve(argument('--out-dir') ?? path.join(pocRoot, 'output', 'params'));

  const raw = JSON.parse(await fs.readFile(inputPath, 'utf8')) as MultiMediaPocInput;
  // 验证用基座：短时长（省时间）+ 给首个片段一个备注（否则 detailShow.note 无从观察）
  const baseInput: MultiMediaPocInput = {
    ...raw,
    intro: raw.intro ?? '验证用序言',
    media: raw.media.map((media, mi) => ({
      ...media,
      clips: media.clips.map((clip, ci) => (mi === 0 && ci === 0 ? { ...clip, note: '验证用片段备注' } : clip)),
    })),
    params: {
      ...DEFAULT_PARAMS,
      durations: { opening: 2, intro: 1, group: 1, detail: 3, ending: 1 },
    },
  };
  const basePlan = buildScenePlan(baseInput);
  const firstId = raw.media[0]?.mediaId;
  const lastId = raw.media[raw.media.length - 1]?.mediaId;

  await fs.mkdir(outDir, { recursive: true });
  const assetServer = await startAssetServer(pocRoot);
  const serveUrl = await bundle({ entryPoint: path.join(projectRoot, 'src', 'index.ts') });
  const browser = await openBrowser('chrome', { logLevel: 'error' });

  const withParams = (extra: Partial<RenderParams>): MultiMediaPocInput => ({
    ...baseInput,
    assetBaseUrl: assetServer.baseUrl,
    params: { ...baseInput.params, ...extra },
  });

  const still = async (label: string, input: MultiMediaPocInput, frame: number): Promise<string> => {
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: { input }, puppeteerInstance: browser });
    const bounded = Math.max(0, Math.min(composition.durationInFrames - 1, frame));
    const output = path.join(outDir, `${label}.png`);
    await renderStill({
      composition,
      serveUrl,
      output,
      inputProps: { input },
      frame: bounded,
      imageFormat: 'png',
      scale,
      overwrite: true,
      puppeteerInstance: browser,
    });
    return sha256(await fs.readFile(output));
  };

  const baselineCache = new Map<string, string>();
  const baselineHash = async (label: string, base: Partial<RenderParams>, frame: number): Promise<string> => {
    const cacheKey = `${JSON.stringify(base)}@${frame}`;
    const cached = baselineCache.get(cacheKey);
    if (cached) return cached;
    const hash = await still(`${label}-baseline`, withParams(base), frame);
    baselineCache.set(cacheKey, hash);
    return hash;
  };

  const results: { key: string; desc: string; frame: number; verdict: '生效' | '未生效' | '出错'; detail?: string }[] = [];
  const cases = buildCases(firstId, lastId);
  const selected = only ? cases.filter((item) => only.includes(String(item.key))) : cases;

  for (const item of selected) {
    const base = item.base ?? {};
    const frame = item.frameOf(basePlan);
    const label = String(item.key);
    try {
      const before = await baselineHash(label, base, frame);
      const mutant = await still(`${label}-changed`, withParams({ ...base, [item.key]: item.to } as Partial<RenderParams>), frame);
      const effective = mutant !== before;
      results.push({ key: label, desc: item.desc, frame, verdict: effective ? '生效' : '未生效' });
      console.log(`${effective ? '✅ 生效  ' : '⚠️  未生效'} ${label.padEnd(18)} ${item.desc}  (frame ${frame})`);
    } catch (error) {
      results.push({ key: label, desc: item.desc, frame, verdict: '出错', detail: String(error) });
      console.log(`❌ 出错    ${label.padEnd(18)} ${String(error)}`);
    }
  }

  // —— 计划级参数：不走像素，直接断言 ScenePlan 变化 ——
  const durations = { opening: 2, intro: 1, group: 1, detail: 3, ending: 1 };
  const planCheck = (extra: Partial<RenderParams>, read: (plan: ScenePlan) => unknown): unknown =>
    read(buildScenePlan(withParams({ durations, ...extra })));
  const planResults = [
    { key: 'durations.opening', ok: planCheck({ durations: { ...durations, opening: 12 } }, (p) => p.durationInFrames) !== planCheck({ durations }, (p) => p.durationInFrames) },
    { key: 'durations.intro', ok: planCheck({ durations: { ...durations, intro: 9 } }, (p) => p.durationInFrames) !== planCheck({ durations }, (p) => p.durationInFrames) },
    { key: 'durations.detail', ok: planCheck({ durations: { ...durations, detail: 14 } }, (p) => p.durationInFrames) !== planCheck({ durations }, (p) => p.durationInFrames) },
    { key: 'durations.ending', ok: planCheck({ durations: { ...durations, ending: 9 } }, (p) => p.durationInFrames) !== planCheck({ durations }, (p) => p.durationInFrames) },
    { key: 'fps', ok: planCheck({ fps: 60 }, (p) => p.fps) !== planCheck({}, (p) => p.fps) },
    { key: 'width', ok: planCheck({ width: 1920 }, (p) => p.width) !== planCheck({}, (p) => p.width) },
    { key: 'height', ok: planCheck({ height: 1080 }, (p) => p.height) !== planCheck({}, (p) => p.height) },
    // 按决策 B 不消费（有意不实现，非待办）；列在这里仅为了报告里显式列出
    { key: 'durations.group', ok: false },
    { key: 'groupBy', ok: false },
    { key: 'groupSort', ok: false },
    { key: 'perScreen', ok: false },
  ];
  const notConsumed: string[] = [];
  for (const item of planResults) {
    const skipped = NOT_CONSUMED_KEYS.includes(item.key as keyof RenderParams) || item.key === 'durations.group';
    if (skipped) {
      notConsumed.push(item.key);
      console.log(`➖ 不消费  ${item.key.padEnd(18)} 决策 B：本版不补「分组网格屏」`);
      continue;
    }
    results.push({ key: item.key, desc: '计划级', frame: -1, verdict: item.ok ? '生效' : '未生效' });
    console.log(`${item.ok ? '✅ 生效  ' : '⚠️  未生效'} ${item.key.padEnd(18)} 计划级断言`);
  }

  // —— 确定性对照：同一输入渲两次，字节必须完全相同，否则上面的「字节不同 = 生效」判定不成立 ——
  const controlFrame = mid('COLLECTION_OPENING')(basePlan);
  const controlA = await still('control-a', withParams({}), controlFrame);
  const controlB = await still('control-b', withParams({}), controlFrame);
  const determinism = { frame: controlFrame, identical: controlA === controlB, hash: controlA.slice(0, 12) };
  console.log(`${determinism.identical ? '✅ 对照  ' : '❌ 对照  '} 确定性对照（同输入两渲${determinism.identical ? '字节一致' : '字节不一致！'}）`);

  await browser.close({ silent: true });
  await assetServer.close();

  const report = {
    input: inputPath,
    composition: COMPOSITION_ID,
    scale,
    durationInFrames: basePlan.durationInFrames,
    fps: basePlan.fps,
    size: `${basePlan.width}x${basePlan.height}`,
    determinism,
    notConsumed,
    results,
    summary: {
      生效: results.filter((r) => r.verdict === '生效').length,
      未生效: results.filter((r) => r.verdict === '未生效').length,
      出错: results.filter((r) => r.verdict === '出错').length,
    },
  };
  const reportPath = path.join(outDir, 'param-verification.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n报告: ${reportPath}`);
  console.log(JSON.stringify(report.summary));
  if (report.summary.出错 > 0 || !determinism.identical) process.exitCode = 1;
}

await main();
