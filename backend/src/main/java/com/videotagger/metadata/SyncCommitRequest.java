package com.videotagger.metadata;

import java.util.List;

/** 提交同步（设计规格 §5.3）：`externalId` 是唯一可信来源，详情与集资料由服务端重新拉取。 */
public record SyncCommitRequest(List<Item> items) {

    public record Item(String externalId, String action, Long mediaId) {
    }
}
