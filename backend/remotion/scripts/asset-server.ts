import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

/** 相对路径安全解析：拒绝绝对路径与越界，返回绝对路径或 null。 */
export function safePath(root: string, relative: string): string | null {
  if (!relative || path.isAbsolute(relative)) return null;
  const file = path.resolve(root, relative);
  return file.startsWith(`${root}${path.sep}`) ? file : null;
}

/** 本地静态资源服务：Remotion 通过 HTTP 读素材，不传 file://。 */
export async function startAssetServer(root: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    const relative = decodeURIComponent((request.url || '').replace(/^\/assets\/?/, ''));
    const file = safePath(root, relative);
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
