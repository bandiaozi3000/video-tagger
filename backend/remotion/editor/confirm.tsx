/**
 * 风格统一的确认弹窗（替代原生 `window.confirm` / `window.alert`）。
 *
 * 背景：主站 `app.js` 早就有 `showConfirm` / `confirmAsync` 这套统一弹窗，编辑器里却漏了
 * 5 处原生调用（2026-09-21 用户指出）。这里按同一个思路做成 Promise 版：
 * 调用点写 `if (!(await confirmDialog({...}))) return;`，UI 由根部的 {@link ConfirmHost} 统一渲染
 * （复用编辑器既有的 `.vt-overlay` + `.vt-panel` 视觉语言，不引入原生弹窗）。
 *
 * 为什么不是每个调用点各写一个 useState：一处状态一份弹窗，5 个调用点要 5 份；
 * 一个 Host + 模块级单例最省，也让 `await` 写法跟主站一致。
 */
import * as React from 'react';

interface ConfirmRequest {
  title: string;
  msg: string;
  okText: string;
  danger: boolean;
  /** 单按钮提示（替代原生 alert）：只显示确定。 */
  single: boolean;
}

let request: ConfirmRequest | null = null;
let resolver: ((value: boolean) => void) | null = null;
const subscribers = new Set<() => void>();

function emit(): void {
  for (const notify of subscribers) notify();
}

/**
 * 弹确认框。确定 → true；取消 / 点遮罩 / 按 Esc → false。
 * 已有弹窗未关闭时再次调用：旧的那个按「取消」收尾（避免 Promise 永远悬空）。
 */
export function confirmDialog(opts: {
  msg: string;
  title?: string;
  okText?: string;
  danger?: boolean;
  single?: boolean;
}): Promise<boolean> {
  resolver?.(false);
  request = {
    title: opts.title ?? '确认',
    msg: opts.msg,
    okText: opts.okText ?? '确定',
    danger: opts.danger ?? true,
    single: opts.single ?? false,
  };
  emit();
  return new Promise<boolean>((resolve) => {
    resolver = resolve;
  });
}

/** 单按钮提示（替代原生 alert）。 */
export function alertDialog(msg: string, title = '提示'): Promise<boolean> {
  return confirmDialog({ msg, title, okText: '知道了', danger: false, single: true });
}

export function ConfirmHost(): React.ReactElement | null {
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    subscribers.add(force);
    return () => {
      subscribers.delete(force);
    };
  }, [force]);

  const close = React.useCallback((value: boolean) => {
    const finish = resolver;
    resolver = null;
    request = null;
    emit();
    finish?.(value);
  }, []);

  // Esc = 取消（确认框里最安全的一侧）
  React.useEffect(() => {
    if (!request) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
      if (event.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!request) return null;
  const current = request;
  return (
    <div className="vt-overlay"
         onMouseDown={(event) => {
           if (event.target === event.currentTarget) close(false);
         }}>
      <div className="vt-panel vt-panel-narrow">
        <div className="vt-panel-head">
          <strong>{current.title}</strong>
        </div>
        <p className="vt-confirm-msg">{current.msg}</p>
        <div className="vt-confirm-btns">
          {current.single ? null : (
            <button type="button" className="btn-mini" onClick={() => close(false)}>取消</button>
          )}
          <button type="button"
                  className={`btn-mini${current.danger ? ' vt-danger' : ''}`}
                  autoFocus
                  onClick={() => close(true)}>{current.okText}</button>
        </div>
      </div>
    </div>
  );
}
