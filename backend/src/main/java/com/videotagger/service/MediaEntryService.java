package com.videotagger.service;

import com.videotagger.entity.MediaEntry;
import com.videotagger.mapper.MediaEntryMapper;
import org.springframework.stereotype.Service;

@Service
public class MediaEntryService {
    private final MediaEntryMapper mapper;

    public MediaEntryService(MediaEntryMapper mapper) {
        this.mapper = mapper;
    }

    public MediaEntry ensureLegacy(long mediaId, String title) {
        MediaEntry entry = mapper.selectLegacy(mediaId, "LEGACY", 0);
        if (entry != null) return entry;
        long now = System.currentTimeMillis();
        entry = new MediaEntry();
        entry.setMediaId(mediaId);
        entry.setEntryType("LEGACY");
        entry.setSortOrder(0);
        entry.setTitle(title);
        entry.setTitleCn(title);
        entry.setCreatedAt(now);
        entry.setUpdatedAt(now);
        mapper.insert(entry);
        return entry;
    }
}
