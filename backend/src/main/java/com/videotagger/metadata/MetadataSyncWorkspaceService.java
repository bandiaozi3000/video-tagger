package com.videotagger.metadata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.MetadataSyncDraft;
import com.videotagger.entity.MetadataSyncTask;
import com.videotagger.entity.MetadataSyncTaskItem;
import com.videotagger.mapper.MetadataSyncDraftMapper;
import com.videotagger.mapper.MetadataSyncTaskItemMapper;
import com.videotagger.mapper.MetadataSyncTaskMapper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class MetadataSyncWorkspaceService {
    private static final long SINGLETON_DRAFT_ID = 1L;

    private final MetadataSyncDraftMapper draftMapper;
    private final MetadataSyncTaskMapper taskMapper;
    private final MetadataSyncTaskItemMapper itemMapper;
    private final MetadataSyncTaskExecutor executor;
    private final ObjectMapper objectMapper;

    public MetadataSyncWorkspaceService(MetadataSyncDraftMapper draftMapper, MetadataSyncTaskMapper taskMapper,
                                        MetadataSyncTaskItemMapper itemMapper, MetadataSyncTaskExecutor executor,
                                        ObjectMapper objectMapper) {
        this.draftMapper = draftMapper;
        this.taskMapper = taskMapper;
        this.itemMapper = itemMapper;
        this.executor = executor;
        this.objectMapper = objectMapper;
    }

    public MetadataSyncDraftView getDraft() {
        MetadataSyncDraft draft = draftMapper.selectLatest();
        return draft == null ? null : toDraftView(draft);
    }

    @Transactional
    public MetadataSyncDraftView saveDraft(MetadataSyncDraftRequest request) {
        if (request == null) throw new IllegalArgumentException("草稿不能为空");
        long now = System.currentTimeMillis();
        MetadataSyncDraft draft = draftMapper.selectById(SINGLETON_DRAFT_ID);
        if (draft == null) {
            draft = new MetadataSyncDraft();
            draft.setId(SINGLETON_DRAFT_ID);
            draft.setCreatedAt(now);
        }
        draft.setProvider(provider(request.provider()));
        draft.setQueryJson(write(request.query(), objectMapper.createObjectNode()));
        draft.setCandidatesJson(write(request.candidates(), objectMapper.createArrayNode()));
        draft.setReviewJson(write(request.review(), objectMapper.createObjectNode()));
        draft.setViewJson(write(request.view(), objectMapper.createObjectNode()));
        draft.setUpdatedAt(now);
        if (draftMapper.selectById(SINGLETON_DRAFT_ID) == null) draftMapper.insert(draft); else draftMapper.updateById(draft);
        return toDraftView(draft);
    }

    public void deleteDraft() {
        draftMapper.deleteAll();
    }

    @Transactional
    public MetadataSyncTaskDetail createTask(MetadataSyncTaskCreateRequest request) {
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("至少选择一个同步项");
        }
        boolean automatic = Boolean.TRUE.equals(request.automatic());
        long now = System.currentTimeMillis();
        MetadataSyncTask task = new MetadataSyncTask();
        task.setTaskId(UUID.randomUUID().toString());
        task.setProvider(provider(request.provider()));
        task.setScopeType(blankToDefault(request.scopeType(), "CUSTOM"));
        task.setQueryJson(write(request.query(), objectMapper.createObjectNode()));
        task.setStatus("QUEUED");
        task.setStage("QUEUED");
        task.setTotal(request.items().size());
        task.setSelectedTotal(0);
        task.setCreateCount(0);
        task.setUpdateCount(0);
        task.setLinkCount(0);
        task.setSkipCount(0);
        task.setProcessed(0);
        task.setSucceeded(0);
        task.setFailed(0);
        task.setPendingReview(0);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        taskMapper.insert(task);

        int selected = 0;
        int creates = 0;
        int updates = 0;
        int links = 0;
        int skips = 0;
        int pending = 0;
        for (MetadataSyncTaskCreateRequest.Item submitted : request.items()) {
            PlannedItem planned = plan(submitted, automatic);
            MetadataSyncTaskItem item = new MetadataSyncTaskItem();
            item.setTaskId(task.getId());
            item.setProvider(task.getProvider());
            item.setExternalId(required(submitted.externalId(), "externalId"));
            item.setTitle(submitted.title());
            item.setTitleCn(submitted.titleCn());
            item.setAction(planned.action());
            item.setTargetMediaId(planned.targetMediaId());
            item.setStatus(planned.status());
            item.setStage(planned.status());
            item.setAttempts(0);
            item.setSnapshotJson(write(submitted.snapshot(), objectMapper.valueToTree(submitted)));
            item.setCreatedAt(now);
            item.setUpdatedAt(now);
            itemMapper.insert(item);
            switch (planned.status()) {
                case "PENDING_REVIEW" -> { pending++; skips++; }
                case "SKIPPED" -> skips++;
                default -> {
                    selected++;
                    switch (planned.action()) {
                        case "CREATE" -> creates++;
                        case "UPDATE" -> updates++;
                        case "LINK" -> links++;
                        default -> { }
                    }
                }
            }
        }
        task.setSelectedTotal(selected);
        task.setCreateCount(creates);
        task.setUpdateCount(updates);
        task.setLinkCount(links);
        task.setSkipCount(skips);
        task.setPendingReview(pending);
        taskMapper.updateById(task);
        draftMapper.deleteAll();
        scheduleAfterCommit(task.getId());
        return detail(task);
    }

    public List<MetadataSyncTask> listTasks() {
        return taskMapper.listRecent();
    }

    public MetadataSyncTaskDetail getTask(String taskId) {
        return detail(requireTask(taskId));
    }

    @Transactional
    public void deleteTask(String taskId) {
        MetadataSyncTask task = requireTask(taskId);
        if (!"DONE".equals(task.getStatus())) {
            throw new IllegalArgumentException("仅可删除已成功完成的同步任务");
        }
        itemMapper.deleteByTask(task.getId());
        taskMapper.deleteById(task.getId());
    }

    @Transactional
    public MetadataSyncTaskDetail retryItem(String taskId, long itemId, MetadataSyncTaskItemRetryRequest request) {
        MetadataSyncTask task = requireTask(taskId);
        MetadataSyncTaskItem item = itemMapper.selectTaskItem(task.getId(), itemId);
        if (item == null) throw new NoSuchElementException("同步任务项不存在: " + itemId);
        if (!"FAILED".equals(item.getStatus()) && !"PENDING_REVIEW".equals(item.getStatus())) {
            throw new IllegalArgumentException("仅失败或待人工审核的项目可以重试");
        }
        PlannedItem planned = validateManual(request == null ? null : request.action(),
                request == null ? null : request.targetMediaId(), null);
        item.setAction(planned.action());
        item.setTargetMediaId(planned.targetMediaId());
        item.setStatus("QUEUED");
        item.setStage("QUEUED");
        item.setErrorMessage(null);
        item.setUpdatedAt(System.currentTimeMillis());
        itemMapper.updateById(item);
        task.setStatus("QUEUED");
        task.setStage("QUEUED");
        task.setCompletedAt(null);
        task.setRetentionUntil(null);
        task.setUpdatedAt(System.currentTimeMillis());
        taskMapper.updateById(task);
        scheduleAfterCommit(task.getId());
        return detail(task);
    }

    @Scheduled(cron = "0 20 3 * * *")
    public void cleanupExpiredSuccessfulTasks() {
        for (MetadataSyncTask task : taskMapper.listExpired(System.currentTimeMillis())) {
            itemMapper.deleteByTask(task.getId());
            taskMapper.deleteById(task.getId());
        }
    }

    private PlannedItem plan(MetadataSyncTaskCreateRequest.Item item, boolean automatic) {
        if (item == null) throw new IllegalArgumentException("同步项不能为空");
        if (!automatic) return validateManual(item.action(), item.targetMediaId(), item.matchType());
        String matchType = normalize(item.matchType());
        if ("EXTERNAL_ID".equals(matchType) && item.targetMediaId() != null) {
            return new PlannedItem("UPDATE", item.targetMediaId(), "QUEUED");
        }
        if ("NONE".equals(matchType)) return new PlannedItem("CREATE", null, "QUEUED");
        return new PlannedItem("SKIP", item.targetMediaId(), "PENDING_REVIEW");
    }

    private PlannedItem validateManual(String actionValue, Long targetMediaId, String matchTypeValue) {
        String action = normalize(actionValue);
        String matchType = normalize(matchTypeValue);
        if ("CONFLICT".equals(matchType) && !"SKIP".equals(action)
                && (!"LINK".equals(action) || targetMediaId == null)) {
            throw new IllegalArgumentException("冲突候选必须先指定唯一目标媒体");
        }
        return switch (action) {
            case "CREATE" -> new PlannedItem(action, null, "QUEUED");
            case "UPDATE", "LINK" -> {
                if (targetMediaId == null) throw new IllegalArgumentException(action + " 动作必须指定目标媒体");
                yield new PlannedItem(action, targetMediaId, "QUEUED");
            }
            case "SKIP" -> new PlannedItem(action, targetMediaId, "SKIPPED");
            default -> throw new IllegalArgumentException("不支持的同步动作: " + actionValue);
        };
    }

    private MetadataSyncTask requireTask(String taskId) {
        MetadataSyncTask task = taskMapper.selectByTaskId(taskId);
        if (task == null) throw new NoSuchElementException("同步任务不存在: " + taskId);
        return task;
    }

    private MetadataSyncTaskDetail detail(MetadataSyncTask task) {
        return new MetadataSyncTaskDetail(task, itemMapper.listByTask(task.getId()));
    }

    private MetadataSyncDraftView toDraftView(MetadataSyncDraft draft) {
        return new MetadataSyncDraftView(draft.getProvider(), read(draft.getQueryJson()), read(draft.getCandidatesJson()),
                read(draft.getReviewJson()), read(draft.getViewJson()), draft.getCreatedAt(), draft.getUpdatedAt());
    }

    private void scheduleAfterCommit(long taskDatabaseId) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    executor.runAsync(taskDatabaseId);
                }
            });
        } else {
            executor.runAsync(taskDatabaseId);
        }
    }

    private String write(JsonNode node, JsonNode fallback) {
        try {
            return objectMapper.writeValueAsString(node == null || node.isNull() ? fallback : node);
        } catch (Exception error) {
            throw new IllegalArgumentException("JSON 数据无效", error);
        }
    }

    private JsonNode read(String value) {
        try {
            return objectMapper.readTree(value == null || value.isBlank() ? "{}" : value);
        } catch (Exception error) {
            return objectMapper.createObjectNode();
        }
    }

    private static String provider(String value) {
        return blankToDefault(value, MetadataSyncService.PROVIDER_BANGUMI).toUpperCase(Locale.ROOT);
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " 不能为空");
        return value.trim();
    }

    private static String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private record PlannedItem(String action, Long targetMediaId, String status) { }
}