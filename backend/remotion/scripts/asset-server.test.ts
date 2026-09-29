import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safePath, startAssetServer } from './asset-server';

/**
 * 素材服务的两个根（2026-09-27 导出 Target closed 的修复）：
 *  - `<root>/assets/**`  片段 / BGM / sting
 *  - `/covers/**`        封面（**根相对**，与浏览器预览同一套路径语义）
 *
 * 这两条断言就钉住三件踩过的事：封面挂上了、越界被拒、没挂封面根时明确 404（而不是静默把 `/covers/...`
 * 当素材相对路径去 root 里找）。
 */
describe('asset-server', () => {
  it('封面走 /covers/** 根、素材走 /assets/**，越界拒绝，未挂载封面根 404', async () => {
    const work = await mkdtemp(path.join(os.tmpdir(), 'vt-asset-'));
    const covers = await mkdtemp(path.join(os.tmpdir(), 'vt-covers-'));
    await mkdir(path.join(covers, 'ext'), { recursive: true });
    await writeFile(path.join(covers, 'ext', 'a.jpg'), 'cover-bytes');
    await writeFile(path.join(work, 'clip-1.mp4'), 'clip-bytes');

    const server = await startAssetServer(work, covers);
    const origin = new URL(server.baseUrl).origin;
    try {
      const cover = await fetch(`${origin}/covers/ext/a.jpg`);
      expect(cover.status).toBe(200);
      expect(cover.headers.get('content-type')).toBe('image/jpeg');
      expect(await cover.text()).toBe('cover-bytes');

      const clip = await fetch(`${server.baseUrl}/clip-1.mp4`);
      expect(clip.status).toBe(200);
      expect(await clip.text()).toBe('clip-bytes');

      expect((await fetch(`${origin}/covers/ext/missing.jpg`)).status).toBe(404);
      expect((await fetch(`${server.baseUrl}/missing.mp4`)).status).toBe(404);
    } finally {
      await server.close();
    }

    const bare = await startAssetServer(work);
    try {
      expect((await fetch(`${new URL(bare.baseUrl).origin}/covers/ext/a.jpg`)).status).toBe(404);
    } finally {
      await bare.close();
    }

    // 越界（相对路径爬出根 / 绝对路径）必须拒绝，别把整个盘当素材根
    expect(safePath(process.cwd(), '..\\..\\secret.txt')).toBeNull();
    expect(safePath(process.cwd(), 'C:\\Windows\\win.ini')).toBeNull();
  });
});
