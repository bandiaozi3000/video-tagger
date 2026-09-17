/**
 * 素材 URL 拼装（渲染与预览两种环境共用）。
 *
 * 三种值直接透传，不加基址：
 *   - `http(s)://…` 外部绝对地址
 *   - `data:…`      data URI（无头渲染用：自足、不依赖后端在线）
 *   - `/…`          根相对路径（**浏览器预览用**：封面走 `/covers/x.jpg`，由后端静态托管直接给）
 * 其余按「相对素材路径」拼 `assetBaseUrl/…`（预览时的片段素材在 `/recommend-previews/<token>/media/…`）。
 */
export function assetUrl(value: string, assetBaseUrl: string): string {
  if (/^(https?:|data:|\/)/i.test(value)) return value;
  return `${assetBaseUrl}/${value}`;
}
