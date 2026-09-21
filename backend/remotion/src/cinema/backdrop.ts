/**
 * 片段幕那层「模糊背景视频」要不要渲染。（纯函数，好测）
 *
 * 为什么要判：那层是**第二个视频层**，实测一个视频层 ≈ 50ms/帧（1080P），
 * 占片段帧耗时的 ~40%（121 → 70 ms/帧）。而当前景 `objectFit: contain` 已经铺满画幅时
 * （片段与画幅同比，例如都是 16:9），那层**一个像素都看不见** —— 白烧 40% 时间。
 *
 * 所以：探到尺寸且与画幅同比（容差 1%）→ 不渲染；尺寸未知 → **保守渲染**（宁多花时间也别露黑边）。
 */

/** 同比容差：1920x1080 vs 1280x720 会有小数误差，1% 足够。 */
const ASPECT_TOLERANCE = 0.01;

export function needsBlurBackdrop(clip: { assetWidth?: number; assetHeight?: number }, frameWidth: number, frameHeight: number): boolean {
  const w = clip.assetWidth ?? 0;
  const h = clip.assetHeight ?? 0;
  if (w <= 0 || h <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return true;   // 尺寸未知 → 保守
  }
  const assetAspect = w / h;
  const frameAspect = frameWidth / frameHeight;
  return Math.abs(assetAspect - frameAspect) / frameAspect > ASPECT_TOLERANCE;
}
