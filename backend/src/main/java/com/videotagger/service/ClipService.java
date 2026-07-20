package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.EmbeddingTask;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EmbeddingTaskMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClipService {

    private static final long DEDUP_WINDOW_MS = 3_000;

    private final ClipMapper clipMapper;
    private final EmbeddingTaskMapper taskMapper;

    public ClipService(ClipMapper clipMapper, EmbeddingTaskMapper taskMapper) {
        this.clipMapper = clipMapper;
        this.taskMapper = taskMapper;
    }

    @Transactional
    public SaveClipResult save(SaveClipRequest req) {
        long now = System.currentTimeMillis();

        Clip recent = clipMapper.findRecentByUrl(req.url(), now - DEDUP_WINDOW_MS);
        if (recent != null) {
            return new SaveClipResult(recent.getId(), true);
        }

        Clip clip = new Clip();
        clip.setTitle(req.title());
        clip.setUrl(req.url());
        clip.setTimestampSec(req.timestampSec());
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
}
