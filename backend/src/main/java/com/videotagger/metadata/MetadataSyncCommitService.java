package com.videotagger.metadata;

import com.videotagger.entity.Media;
import com.videotagger.mapper.MediaMapper;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 逐项提交同步（2026-09-21 新流程）。
 *
 * **为什么单独一个类**：`MetadataSyncService.syncOne` 带 `@Transactional`，若在本类内自调用
 * （this.syncOne）注解会失效（Spring 代理不拦自调用）→ 就会出现"写了一半"的脏数据。
 * 放在独立 bean 里经由代理调用，才能保证**每项各自一个事务**，一项失败不影响其它项。
 */
@Service
public class MetadataSyncCommitService {

    private final MetadataSyncService syncService;
    private final MediaMapper mediaMapper;
    private final com.videotagger.mapper.ExternalWorkMapper externalWorkMapper;

    public MetadataSyncCommitService(MetadataSyncService syncService, MediaMapper mediaMapper,
                                     com.videotagger.mapper.ExternalWorkMapper externalWorkMapper) {
        this.syncService = syncService;
        this.mediaMapper = mediaMapper;
        this.externalWorkMapper = externalWorkMapper;
    }

    public SyncCommitResult commit(SyncCommitRequest request) {
        List<SyncCommitRequest.Item> items = request == null || request.items() == null
                ? List.of() : request.items().stream().filter(item -> item != null && item.externalId() != null
                && !item.externalId().isBlank()).toList();
        List<SyncCommitResult.ItemResult> results = new ArrayList<>();
        int added = 0;
        int updated = 0;
        int skipped = 0;
        int failed = 0;
        for (SyncCommitRequest.Item item : items) {
            String action = item.action() == null || item.action().isBlank()
                    ? SyncActionDecider.actionFor(null) : item.action();
            if ("SKIP".equalsIgnoreCase(action)) {
                skipped++;
                results.add(new SyncCommitResult.ItemResult(item.externalId(), "SKIPPED", item.mediaId(), null, null));
                continue;
            }
            try {
                MetadataSyncResult result = syncService.syncOne(item.externalId(), action, item.mediaId());
                boolean created = result.added() > 0;
                if (created) {
                    added++;
                } else {
                    updated++;
                }
                // 回填本次真正写到哪个媒体（新增时是刚建的那条）—— 接口返回的 mediaId 对 CREATE 是空的，
                // 靠 external_work 反查才算准，前端要拿它显示「已更新 #6917」。
                Long mediaId = item.mediaId();
                String title = null;
                com.videotagger.entity.ExternalWork linked = externalWorkMapper
                        .selectByProviderAndExternalId("BANGUMI", item.externalId());
                if (linked != null && linked.getMediaId() != null) {
                    mediaId = linked.getMediaId();
                    Media media = mediaMapper.selectById(mediaId);
                    title = media == null ? null : media.getTitle();
                }
                results.add(SyncCommitResult.ItemResult.ok(item.externalId(), created ? "ADDED" : "UPDATED",
                        mediaId, title));
            } catch (RuntimeException e) {
                failed++;
                results.add(SyncCommitResult.ItemResult.failed(item.externalId(), null,
                        e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            }
        }
        return new SyncCommitResult(items.size(), added, updated, skipped, failed, results);
    }

    /** 回填本次实际写到哪个媒体（新增时靠 external_work 反查）。 */
    private Long targetMediaId(SyncCommitRequest.Item item) {
        if (item.mediaId() != null) {
            return item.mediaId();
        }
        com.videotagger.entity.ExternalWork work = externalWorkMapper
                .selectByProviderAndExternalId("BANGUMI", item.externalId());
        return work == null ? null : work.getMediaId();
    }
}
