package com.videotagger.metadata;

import java.util.List;

/** 同步结果与「同步条数」。 */
public record SyncCommitResult(int total, int added, int updated, int skipped, int failed,
                               List<ItemResult> items) {

    public record ItemResult(String externalId, String status, Long mediaId, String title, String error) {

        public static ItemResult ok(String externalId, String status, Long mediaId, String title) {
            return new ItemResult(externalId, status, mediaId, title, null);
        }

        public static ItemResult failed(String externalId, String title, String error) {
            return new ItemResult(externalId, "FAILED", null, title, error);
        }
    }
}
