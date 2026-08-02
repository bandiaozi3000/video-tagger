package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.EmbeddingTask;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EmbeddingTaskMapper;
import com.videotagger.util.VideoFingerprint;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
public class ClipService {

    private static final long DEDUP_WINDOW_MS = 3_000;
    /** 误触判定：同 URL 3 秒内 且 时间戳相距小于该值（秒）才算同一片段 */
    private static final double DEDUP_TIME_TOLERANCE_SEC = 3.0;

    private final ClipMapper clipMapper;
    private final EmbeddingTaskMapper taskMapper;
    private final VectorStore vectorStore;

    public ClipService(ClipMapper clipMapper, EmbeddingTaskMapper taskMapper, VectorStore vectorStore) {
        this.clipMapper = clipMapper;
        this.taskMapper = taskMapper;
        this.vectorStore = vectorStore;
    }

    @Transactional
    public SaveClipResult save(SaveClipRequest req) {
        long now = System.currentTimeMillis();

        // 仅当同 URL、3 秒内、时间戳接近、且标签相同时才视为误触连按（去重）。
        // 同片段补不同标签属于「追加标注」，走新建记录，避免静默吞数据。
        Clip recent = clipMapper.findRecentNearTime(req.url(), now - DEDUP_WINDOW_MS,
                req.timestampSec(), DEDUP_TIME_TOLERANCE_SEC);
        if (recent != null && recent.getTag().equals(req.tag())) {
            return new SaveClipResult(recent.getId(), true);
        }

        Clip clip = new Clip();
        clip.setTitle(req.title());
        clip.setUrl(req.url());
        clip.setVideoFp(VideoFingerprint.fingerprint(req.url()));
        clip.setTimestampSec(req.timestampSec());
        clip.setVideoDuration(req.videoDuration());
        clip.setTag(req.tag());
        clip.setNote(req.note() == null ? "" : req.note());
        clip.setCreatedAt(now);
        clipMapper.insert(clip);

        EmbeddingTask task = new EmbeddingTask();
        task.setClipId(clip.getId());
        task.setStatus("PENDING");
        task.setRetryCount(0);
        task.setUpdatedAt(now);
        taskMapper.insert(task);

        return new SaveClipResult(clip.getId(), false);
    }

    /**
     * 编辑标签。tag/note 变化时删除旧向量并重置 embedding 任务为 PENDING（异步重生成）。
     * appendTag=true 时把新 tag 并入原 tag（按空白分词去重）。
     */
    @Transactional
    public Clip update(Long id, SaveClipRequest req, boolean appendTag) {
        Clip clip = clipMapper.selectById(id);
        if (clip == null) {
            throw new NoSuchElementException("clip not found: " + id);
        }
        String oldTag = clip.getTag();
        String oldNote = clip.getNote() == null ? "" : clip.getNote();

        clip.setTitle(req.title());
        clip.setUrl(req.url());
        clip.setVideoFp(VideoFingerprint.fingerprint(req.url()));
        clip.setTimestampSec(req.timestampSec());
        // 编辑请求未携带时长时保留原值
        clip.setVideoDuration(req.videoDuration() != null ? req.videoDuration() : clip.getVideoDuration());
        clip.setTag(appendTag ? appendTag(oldTag, req.tag()) : req.tag());
        clip.setNote(req.note() == null ? "" : req.note());
        clipMapper.updateById(clip);

        if (!oldTag.equals(clip.getTag()) || !oldNote.equals(clip.getNote())) {
            reembed(id);
        }
        return clip;
    }

    /** 删除标签：同时清理 embedding 任务与 Milvus 向量（向量删除失败容忍为孤儿）。 */
    @Transactional
    public boolean delete(Long id) {
        int rows = clipMapper.deleteById(id);
        if (rows == 0) {
            return false;
        }
        taskMapper.deleteById(id);
        vectorStore.delete(id);
        return true;
    }

    private void reembed(long clipId) {
        vectorStore.delete(clipId);
        long now = System.currentTimeMillis();
        EmbeddingTask task = taskMapper.selectById(clipId);
        if (task == null) {
            task = new EmbeddingTask();
            task.setClipId(clipId);
            task.setStatus("PENDING");
            task.setRetryCount(0);
            task.setUpdatedAt(now);
            taskMapper.insert(task);
        } else {
            task.setStatus("PENDING");
            task.setRetryCount(0);
            task.setUpdatedAt(now);
            taskMapper.updateById(task);
        }
    }

    /**
     * 标签补全建议：把高频 tag 字符串按空白拆成单个标签词聚合计数，
     * 过滤含前缀的，按出现次数降序返回前 limit 个。用于扩展浮层输入补全。
     */
    public List<TagSuggestion> suggestTags(String prefix, int limit) {
        Map<String, Long> tally = new HashMap<>();
        for (TagSuggestion ts : clipMapper.countTags(500)) {
            for (String token : ts.tag().trim().split("\\s+")) {
                if (token.isEmpty()) {
                    continue;
                }
                tally.merge(token, ts.count(), Long::sum);
            }
        }
        String p = prefix == null ? "" : prefix.trim().toLowerCase();
        return tally.entrySet().stream()
                .filter(e -> p.isEmpty() || e.getKey().toLowerCase().contains(p))
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Comparator.comparing(Map.Entry::getKey)))
                .limit(limit)
                .map(e -> new TagSuggestion(e.getKey(), e.getValue()))
                .toList();
    }

    /** 查询同一视频中时间戳邻近（±window 秒）的既有标记，供扩展做重复片段提示。 */
    public List<Clip> findNearby(String url, double timestampSec, double window) {
        return clipMapper.findNearby(url, timestampSec, window);
    }

    /** 把新标签并入原标签：按空白分词、去重、空格连接；已存在则原样返回。 */
    static String appendTag(String existing, String added) {
        String trimmed = added == null ? "" : added.trim();
        if (trimmed.isEmpty()) {
            return existing;
        }
        Set<String> tokens = new LinkedHashSet<>();
        for (String t : existing.split("\\s+")) {
            if (!t.isEmpty()) {
                tokens.add(t);
            }
        }
        if (tokens.add(trimmed)) {
            return String.join(" ", tokens);
        }
        return existing;
    }
}
