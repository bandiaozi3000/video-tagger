import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pocRoot = path.join(projectRoot, 'poc');
const inputPath = argument('--input') || path.join(pocRoot, 'sample.json');
const port = Number(argument('--port') || 18126);
const input = await fs.readFile(path.resolve(inputPath), 'utf8');
await fs.writeFile(path.join(pocRoot, 'input.json'), input);

const server = await createServer({
  root: projectRoot,
  publicDir: pocRoot,
  server: { host: '127.0.0.1', port, strictPort: true },
});

server.middlewares.use('/input.json', (_request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(input);
});
server.middlewares.use('/assets', async (request, response) => {
  const relative = decodeURIComponent((request.url || '').replace(/^\//, ''));
  const file = safePath(pocRoot, relative);
  if (!file) {
    response.statusCode = 400;
    response.end('invalid asset path');
    return;
  }
  try {
    const body = await fs.readFile(file);
    response.setHeader('Content-Type', contentType(file));
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.end('asset not found');
  }
});

await server.listen();
console.log(`Player: http://127.0.0.1:${port}`);
console.log(`Input: ${path.resolve(inputPath)}`);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function safePath(root: string, relative: string): string | null {
  const file = path.resolve(root, relative);
  return file === root || file.startsWith(`${root}${path.sep}`) ? file : null;
}

function contentType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.json': 'application/json' } as Record<string, string>)[ext] || 'application/octet-stream';
}
