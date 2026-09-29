import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

/** 相对路径安全解析：拒绝绝对路径与越界，返回绝对路径或 null。 */
export function safePath(root: string, relative: string): string | null {
  if (!relative || path.isAbsolute(relative)) return null;
  const file = path.resolve(root, relative);
  return file.startsWith(`${root}${path.sep}`) ? file : null;
}

/** 本地静态资源服务：Remotion 通过 HTTP 读素材，不传 file://；封面走**根相对**的 `/covers/**`。
 *
 *  两个根：
 *   - `root`      —— 素材根（片段 / BGM / sting / 兜底封面），路径为 `/assets/<相对路径>`
 *   - `coversRoot` —— 封面根（可选），路径为**跟浏览器预览同一套语义**的 `/covers/**`
 *
 *  封面为什么不再内联：2026-09-27 实测 —— Java 的导出链路原先把封面转成 base64 塞进 inputProps，
 *  223 部 Bangumi 高清封面 ≈ 87MB → base64 ≈ 119MB；Remotion 把这坨 props 注入页面时
 *  Chrome 目标直接挂掉（`Page.addScriptToEvaluateOnNewDocument: Target closed`，把 props 灌到 120MB 必现）。
 *  改成走这个 HTTP 根后，props 里只剩 `/covers/ext/xxx.jpg` 这样的短路径。
 *
 *  ⚠️ 两个根都先 `path.resolve` 规范化：`safePath` 拿 `path.resolve` 的结果做前缀比对，
 *  传进来带正斜杠的根（`D:/x/y`）会与 `D:\x\y\...` 比不过 → 全量 400。
 */
export async function startAssetServer(root: string, coversRoot?: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const assetRoot = path.resolve(root);
  const coversBase = coversRoot ? path.resolve(coversRoot) : undefined;
  const server = http.createServer(async (request, response) => {
    const url = (request.url || '').split('?')[0];
    const coverMatch = /^\/covers\/(.+)$/.exec(url);
    if (coverMatch && !coversBase) { response.statusCode = 404; response.end('covers not mounted'); return; }
    const relative = decodeURIComponent(coverMatch ? coverMatch[1] : url.replace(/^\/assets\/?/, ''));
    const file = safePath(coverMatch ? coversBase! : assetRoot, relative);
    if (!file) { response.statusCode = 400; response.end('invalid asset path'); return; }
    try {
      const body = await fs.readFile(file);
      response.setHeader('Content-Type', contentType(file));
      response.end(body);
    } catch { response.statusCode = 404; response.end('asset not found'); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法启动 POC 资源服务');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/assets`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

export function contentType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' } as Record<string, string>)[ext] || 'application/octet-stream';
}
