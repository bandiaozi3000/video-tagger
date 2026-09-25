package com.videotagger.reconcile;

/**
 * 对账处置动作（2026-09-25 用户拍板简化为两类）。
 *
 * <p>规则：
 * <ol>
 *   <li>**没有 Bangumi 关联、且本地无引用痕迹** → 删</li>
 *   <li>**有引用、且能关联到 Bangumi** → 关联（{@link #AUTO}，按命中条目是否已在本地关联再分 LINK / MERGE）</li>
 *   <li>**剩余的其他全部删掉** → 有引用但关联不上的（相似但不精确、或命不中）同样走 {@link #PURGE}</li>
 * </ol>
 *
 * <p>所以只有两类动作；「为什么被删」写在 {@link ReconcileDecision#note()} 里，
 * 供干跑报告区分「无引用无痕迹」/「关联不上」。
 */
public enum ReconcileAction {
    /** 能关联到 Bangumi——交由执行器按「命中条目是否已在本地关联」决定新建关联还是合并。 */
    AUTO,
    /** 删除（无引用无痕迹，或有引用但关联不上）。 */
    PURGE
}
