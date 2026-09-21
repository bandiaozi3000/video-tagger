package com.videotagger.metadata;

/**
 * 匹配结果 → 同步动作（纯函数）。
 *
 * 设计规格 §6。**不用模糊匹配**：实测「剥掉第N季/幕/期后比基名」对真实数据零增益，
 * 而误关联（把 OVA 挂到本体、把重名作品错挂）的代价远大于漏关联。
 */
public final class SyncActionDecider {

    private SyncActionDecider() {
    }

    /** 候选动作：`UPDATE` 稳定关联 / `LINK` 唯一标题命中 / `CREATE` 本地没有 / `SKIP` 命中多个。 */
    public static String actionFor(String matchType) {
        String type = matchType == null ? "" : matchType.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (type) {
            case "EXTERNAL_ID" -> "UPDATE";
            case "TITLE" -> "LINK";
            case "NONE" -> "CREATE";
            default -> "SKIP";   // CONFLICT（命中多个）与未知类型一律跳过，让人工处理
        };
    }

    /** 结果归类：`added` / `updated` / `skipped`（用于「同步条数」）。 */
    public static String bucketFor(String action) {
        String normalized = action == null ? "" : action.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case "CREATE" -> "added";
            case "UPDATE", "LINK" -> "updated";
            default -> "skipped";
        };
    }
}
