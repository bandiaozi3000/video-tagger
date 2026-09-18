/**
 * 参数生效验证 + 帧确定性门禁（设计规格 §12 第 1 条与第 3 条）。
 *
 * 判定方式（不烧整片渲染）：同一帧、同一份输入，**只改一个参数**，各导一张 PNG。
 *   - 两次字节完全相同 ⇒ 参数未生效
 *   - 字节不同         ⇒ 参数生效（参数 → 画面 通道已打通）
 *
 * 三类参数各有判定口径：
 *   1. 画面级（颜色/版式/文案/背景/BGM 条/动效）→ 像素字节比对；
 *   2. 计划级（时长/帧率/分辨率/分组/每屏/模板形态）→ 直接断言 `ScenePlan` 变化；
 *   3. 音频级（BGM 增益 / ducking / 淡入淡出）→ 断言 `bgmGainAt()` 曲线变化（不产生像素差异）。
 *
 * 另有**多场景多帧确定性对照**：同一输入在开场/资料卡/片段/结尾各渲两次，字节必须完全一致。
 * 这是本门禁的重点——CSS 过渡/关键帧之类的"实时时钟动画"正是靠这条抓出来的。
 *
 * 用法：npm run verify:params [-- --input poc/real-input.json --scale 0.5 --only title,coverSize]
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { DEFAULT_PARAMS, type RenderParams } from '../src/params';
import { bgmGainAt } from '../src/bgm';
import { buildScenePlan } from '../src/scene-plan';
import type { MultiMediaPocInput, PocMedia, ScenePlan, SceneType } from '../src/types';
import { startAssetServer } from './asset-server';

const COMPOSITION_ID = 'MultiMediaRecommendPoc';
const projectRoot = path.resolve(import.meta.dirname, '..');
const pocRoot = path.join(projectRoot, 'poc');

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

interface PixelCase {
  key: keyof RenderParams;
  desc: string;
  /** 画面比对用的帧（由基线 ScenePlan 推出） */
  frameOf: (plan: ScenePlan) => number;
  /** 基座参数：基线与变体都带上，用于制造「可观察前提」 */
  base?: Partial<RenderParams>;
  to: unknown;
}

const mid = (type: SceneType, nth = 0) => (plan: ScenePlan): number => {
  const scene = sceneOf(plan, type, nth);
  return scene.fromFrame + Math.floor(scene.durationInFrames / 2);
};
const early = (type: SceneType, offset = 5) => (plan: ScenePlan): number => sceneOf(plan, type, 0).fromFrame + offset;

function sceneOf(plan: ScenePlan, type: SceneType, nth: number) {
  const matched = plan.scenes.filter((scene) => scene.type === type);
  if (!matched[nth]) throw new Error(`场景不存在: ${type}[${nth}]`);
  return matched[nth];
}

function buildPixelCases(): PixelCase[] {
  const one = (name: string) => ({ bgmTracks: [{ name, durationSec: 40 }] });
  return [
    { key: 'title', desc: '主标题', frameOf: mid('COLLECTION_OPENING'), to: '参数验证标题' },
    { key: 'brandTitle', desc: '品牌标题', frameOf: mid('COLLECTION_OPENING'), to: 'BRAND VERIFY' },
    { key: 'subtitle', desc: '副标题', frameOf: mid('COLLECTION_OPENING'), to: '参数验证副标题' },
    { key: 'coverSize', desc: '封面尺寸', frameOf: mid('COLLECTION_OPENING'), to: 92 },
    { key: 'intro', desc: '序言正文', frameOf: mid('COLLECTION_INTRO'), to: '参数验证序言正文，用于确认文案通道。' },
    { key: 'prologueTitle', desc: '序言标题', frameOf: mid('COLLECTION_INTRO'), to: '参数验证序言标题' },
    { key: 'detailShow', desc: '详情状态行', frameOf: mid('MEDIA_INFO'), to: { status: false, note: true, tag: true } },
    { key: 'detailShow', desc: '详情标签区', frameOf: mid('MEDIA_INFO'), to: { status: true, note: true, tag: false } },
    { key: 'detailShow', desc: '片段备注', frameOf: mid('MEDIA_CLIP'), to: { status: true, note: false, tag: true } },
    { key: 'bgColor', desc: '背景底色', frameOf: mid('COLLECTION_OPENING'), to: '#3a1d5c' },
    { key: 'bgImages', desc: '背景图', frameOf: mid('COLLECTION_OPENING'), base: { bgColor: '#101010' }, to: ['media/poster-a.jpg'] },
    {
      key: 'bgRotationSec',
      desc: '背景轮播间隔',
      // 轮播在帧模型下是确定性的，必须选一个「两种间隔下索引必然不同」的帧
      frameOf: mid('COLLECTION_OPENING'),
      base: { bgColor: '#101010', bgImages: ['media/poster-a.jpg', 'media/poster-b.jpg', 'media/poster-c.jpg'] },
      to: 1,
    },
    { key: 'bgOpacity', desc: '背景不透明度', frameOf: mid('COLLECTION_OPENING'), base: { bgColor: '#000000', bgImages: ['media/poster-a.jpg'] }, to: 25 },
    { key: 'bgBlur', desc: '背景模糊', frameOf: mid('COLLECTION_OPENING'), base: { bgColor: '#000000', bgImages: ['media/poster-a.jpg'] }, to: 80 },
    { key: 'bgBrightness', desc: '背景亮度', frameOf: mid('COLLECTION_OPENING'), base: { bgColor: '#000000', bgImages: ['media/poster-a.jpg'] }, to: 100 },
    { key: 'bgmTracks', desc: 'BGM 曲名（胶囊）', frameOf: mid('COLLECTION_OPENING'), base: one('默认曲目'), to: [{ name: '参数验证曲目', durationSec: 40 }] },
    { key: 'bgmScale', desc: 'BGM 条缩放', frameOf: mid('COLLECTION_OPENING'), base: one('参数验证曲目'), to: 165 },
    { key: 'bgmX', desc: 'BGM 条水平位置', frameOf: mid('COLLECTION_OPENING'), base: one('参数验证曲目'), to: 45 },
    { key: 'bgmY', desc: 'BGM 条垂直位置', frameOf: mid('COLLECTION_OPENING'), base: one('参数验证曲目'), to: 30 },
    { key: 'openingSpeed', desc: '开场动效档位', frameOf: early('COLLECTION_OPENING'), to: 100 },
    { key: 'endingScrollSpeed', desc: '结尾动效档位', frameOf: early('COLLECTION_ENDING'), to: 100 },
    { key: 'endingTitle', desc: '结尾标题', frameOf: mid('COLLECTION_ENDING'), to: '参数验证结尾标题' },
    { key: 'endingText', desc: '结尾文案', frameOf: mid('COLLECTION_ENDING'), to: '参数验证结尾文案' },
    { key: 'openingIds', desc: '开场封面带取用', frameOf: mid('COLLECTION_OPENING'), base: { openingIds: [] }, to: undefined },
  ];
}

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

type Verdict = '生效' | '未生效' | '出错';
interface Result { key: string; desc: string; kind: string; frame: number; verdict: Verdict; detail?: string }

async function main(): Promise<void> {
  const inputPath = path.resolve(argument('--input') ?? path.join(pocRoot, 'real-input.json'));
  const scale = Number(argument('--scale') ?? '0.4');
  const only = argument('--only')?.split(',').map((v) => v.trim()).filter(Boolean);
  const outDir = path.resolve(argument('--out-dir') ?? path.join(pocRoot, 'output', 'params'));

  const raw = JSON.parse(await fs.readFile(inputPath, 'utf8')) as MultiMediaPocInput;
  // 验证基座：短时长（省时间）+ 序言有文案 + 首个片段有备注（否则 detailShow.note 无从观察）
  // 注：`poc/real-input.json` 里的 clip 没有 note 时，`detailShow.note` 这一项会恒判「未生效」（假阴性）
  // —— 这里给首个片段补一条备注，让该断言重新可观察（v0.28 修正测量基座）。
  const mediaWithNote: PocMedia[] = raw.media.map((media, index) => index !== 0
    ? media
    : {
        ...media,
        clips: media.clips.map((clip, clipIndex) => clipIndex !== 0
          ? clip
          : { ...clip, note: clip.note?.trim() ? clip.note : '基线片段备注。' }),
      });
  const baseInput: MultiMediaPocInput = {
    ...raw,
    media: mediaWithNote,
    intro: raw.intro?.trim() ? raw.intro : '基线序言文案。',
    params: {
      ...DEFAULT_PARAMS,
      ...raw.params,
      durations: { opening: 4, intro: 3, group: 3, detail: 4, ending: 3 },
      openingIds: [],
      bgmTracks: [],
    },
  };
  const withParams = (extra: Partial<RenderParams>): MultiMediaPocInput => ({
    ...baseInput,
    assetBaseUrl: assetServer.baseUrl,
    params: { ...baseInput.params, ...extra },
  });

  const basePlan = buildScenePlan(baseInput);
  const firstId = baseInput.media[0]?.mediaId;
  const lastId = baseInput.media[baseInput.media.length - 1]?.mediaId;

  await fs.mkdir(outDir, { recursive: true });
  const assetServer = await startAssetServer(pocRoot);
  const serveUrl = await bundle({ entryPoint: path.join(projectRoot, 'src', 'index.ts') });
  const browser = await openBrowser('chrome', { logLevel: 'error' });

  const renderOne = async (label: string, input: MultiMediaPocInput, frame: number): Promise<string> => {
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: { input }, puppeteerInstance: browser });
    const bounded = Math.max(0, Math.min(composition.durationInFrames - 1, frame));
    const output = path.join(outDir, `${label}.png`);
    await renderStill({ composition, serveUrl, output, inputProps: { input }, frame: bounded, imageFormat: 'png', scale, overwrite: true, puppeteerInstance: browser });
    return sha256(await fs.readFile(output));
  };

  const results: Result[] = [];
  const classify = (kind: string, key: string, desc: string, ok: boolean, frame: number, detail?: string) => {
    const verdict: Verdict = ok ? '生效' : '未生效';
    results.push({ key, desc, kind, frame, verdict, detail });
    console.log(`${ok ? '✅ 生效  ' : '⚠️  未生效'} [${kind}] ${key.padEnd(22)} ${desc}`);
  };

  // —— 1. 画面级（像素字节比对）——
  const pixelCases = buildPixelCases().map((item) =>
    item.key === 'openingIds' && firstId !== undefined ? { ...item, to: [firstId] } : item,
  );
  const baselineCache = new Map<string, string>();
  const baselineHash = async (label: string, base: Partial<RenderParams>, frame: number): Promise<string> => {
    const cacheKey = `${JSON.stringify(base)}@${frame}`;
    const cached = baselineCache.get(cacheKey);
    if (cached) return cached;
    const hash = await renderOne(`${label}-baseline`, withParams(base), frame);
    baselineCache.set(cacheKey, hash);
    return hash;
  };
  for (const item of pixelCases) {
    if (only && !only.includes(String(item.key))) continue;
    const base = item.base ?? {};
    const frame = item.frameOf(basePlan);
    try {
      const before = await baselineHash(String(item.key), base, frame);
      const after = await renderOne(`${item.key}-changed`, withParams({ ...base, [item.key]: item.to } as Partial<RenderParams>), frame);
      classify('画面级', String(item.key), item.desc, after !== before, frame);
    } catch (error) {
      results.push({ key: String(item.key), desc: item.desc, kind: '画面级', frame, verdict: '出错', detail: String(error) });
      console.log(`❌ 出错    [画面级] ${String(item.key).padEnd(22)} ${String(error)}`);
    }
  }

  // —— 2. 计划级（ScenePlan 断言）——
  const planCheck = (extra: Partial<RenderParams>, select: (plan: ScenePlan) => unknown): unknown => select(buildScenePlan(withParams(extra)));
  const planCases: { key: string; desc: string; ok: boolean }[] = [
    { key: 'durations.opening', desc: '开场时长', ok: planCheck({ durations: { opening: 12, intro: 3, group: 3, detail: 4, ending: 3 } }, (p) => p.durationInFrames) !== planCheck({}, (p) => p.durationInFrames) },
    { key: 'durations.intro', desc: '序言时长', ok: planCheck({ durations: { opening: 4, intro: 9, group: 3, detail: 4, ending: 3 } }, (p) => p.durationInFrames) !== planCheck({}, (p) => p.durationInFrames) },
    { key: 'durations.group', desc: '章节页时长', ok: planCheck({ groupBy: 'year', durations: { opening: 4, intro: 3, group: 9, detail: 4, ending: 3 } }, (p) => p.durationInFrames) !== planCheck({ groupBy: 'year' }, (p) => p.durationInFrames) },
    { key: 'durations.detail', desc: '资料卡时长', ok: planCheck({ durations: { opening: 4, intro: 3, group: 3, detail: 14, ending: 3 } }, (p) => p.durationInFrames) !== planCheck({}, (p) => p.durationInFrames) },
    { key: 'durations.ending', desc: '结尾时长', ok: planCheck({ durations: { opening: 4, intro: 3, group: 3, detail: 4, ending: 9 } }, (p) => p.durationInFrames) !== planCheck({}, (p) => p.durationInFrames) },
    { key: 'fps', desc: '帧率', ok: planCheck({ fps: 60 }, (p) => p.fps) !== planCheck({}, (p) => p.fps) },
    { key: 'width', desc: '画幅宽', ok: planCheck({ width: 1920 }, (p) => p.width) !== planCheck({}, (p) => p.width) },
    { key: 'height', desc: '画幅高', ok: planCheck({ height: 1080 }, (p) => p.height) !== planCheck({}, (p) => p.height) },
    { key: 'groupBy', desc: '分组维度（章节页）', ok: planCheck({ groupBy: 'year' }, (p) => p.scenes.filter((s) => s.type === 'GROUP_INTRO').length) !== planCheck({}, (p) => p.scenes.filter((s) => s.type === 'GROUP_INTRO').length) },
    { key: 'perScreen', desc: '每屏 N 部（网格）', ok: planCheck({ perScreen: 4 }, (p) => p.scenes.filter((s) => s.type === 'MEDIA_GRID').length) !== planCheck({}, (p) => p.scenes.filter((s) => s.type === 'MEDIA_GRID').length) },
    { key: 'style', desc: '模板形态（clip）', ok: buildScenePlan({ ...baseInput, style: 'clip', params: { ...baseInput.params, groupBy: 'year' } }).scenes.filter((s) => s.type === 'GROUP_INTRO').length !== buildScenePlan(withParams({ groupBy: 'year' })).scenes.filter((s) => s.type === 'GROUP_INTRO').length },
  ];
  for (const item of planCases) {
    if (only && !only.includes(item.key)) continue;
    classify('计划级', item.key, item.desc, item.ok, -1);
  }

  // —— 3. 音频级（增益曲线断言）——
  const audioPlan = basePlan;
  const audioCases: { key: string; desc: string; ok: boolean }[] = [
    {
      key: 'bgmGain',
      desc: 'BGM 基准增益',
      ok: bgmGainAt(0, resolve({ bgmGain: 0.2 }), audioPlan) !== bgmGainAt(0, resolve({ bgmGain: 0.9 }), audioPlan),
    },
    {
      key: 'bgmDuckTo',
      desc: '原声出现时压低到',
      ok: (() => {
        const clip = sceneOf(audioPlan, 'MEDIA_CLIP', 0);
        const mid0 = clip.fromFrame + Math.floor(clip.durationInFrames / 2);
        return bgmGainAt(mid0, resolve({ bgmDuckTo: 0.05 }), audioPlan) !== bgmGainAt(mid0, resolve({ bgmDuckTo: 0.4 }), audioPlan);
      })(),
    },
    {
      key: 'bgmFadeSec',
      desc: 'ducking 渐变时长',
      ok: (() => {
        const clip = sceneOf(audioPlan, 'MEDIA_CLIP', 0);
        const ramp = clip.fromFrame - 10;
        return bgmGainAt(ramp, resolve({ bgmFadeSec: 0.2 }), audioPlan) !== bgmGainAt(ramp, resolve({ bgmFadeSec: 2 }), audioPlan);
      })(),
    },
  ];
  function resolve(extra: Partial<RenderParams>): RenderParams {
    return { ...DEFAULT_PARAMS, ...baseInput.params, ...extra } as RenderParams;
  }
  for (const item of audioCases) {
    if (only && !only.includes(item.key)) continue;
    classify('音频级', item.key, item.desc, item.ok, -1);
  }

  // —— 4. 多场景多帧确定性对照（两次渲染字节必须完全相同）——
  const controlFrames: { label: string; frame: number }[] = [
    { label: '开场', frame: mid('COLLECTION_OPENING')(basePlan) },
    { label: '资料卡', frame: mid('MEDIA_INFO')(basePlan) },
    { label: '片段', frame: mid('MEDIA_CLIP')(basePlan) },
    { label: '结尾', frame: mid('COLLECTION_ENDING')(basePlan) },
  ];
  const determinism: { label: string; frame: number; identical: boolean; hash: string }[] = [];
  for (const control of controlFrames) {
    const a = await renderOne(`control-${control.label}-a`, withParams({}), control.frame);
    const b = await renderOne(`control-${control.label}-b`, withParams({}), control.frame);
    const identical = a === b;
    determinism.push({ label: control.label, frame: control.frame, identical, hash: a.slice(0, 12) });
    console.log(`${identical ? '✅ 对照  ' : '❌ 对照  '} [确定性] ${control.label} 帧 ${control.frame} ${identical ? '两次渲染字节一致' : '两次渲染字节不一致！'}`);
  }

  await browser.close({ silent: true });
  await assetServer.close();

  const report = {
    input: inputPath,
    composition: COMPOSITION_ID,
    scale,
    style: basePlan.style,
    durationInFrames: basePlan.durationInFrames,
    fps: basePlan.fps,
    size: `${basePlan.width}x${basePlan.height}`,
    determinism,
    results,
    summary: {
      生效: results.filter((r) => r.verdict === '生效').length,
      未生效: results.filter((r) => r.verdict === '未生效').length,
      出错: results.filter((r) => r.verdict === '出错').length,
      确定性不一致: determinism.filter((d) => !d.identical).length,
    },
  };
  const reportPath = path.join(outDir, 'param-verification.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n报告: ${reportPath}`);
  console.log(JSON.stringify(report.summary));
  if (report.summary.出错 > 0 || report.summary['确定性不一致'] > 0) process.exitCode = 1;
}

await main();
