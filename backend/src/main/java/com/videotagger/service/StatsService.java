package com.videotagger.service;

import com.videotagger.mapper.ClipMapper;
import org.springframework.stereotype.Service;

@Service
public class StatsService {

    private static final long DAY_MS = 24L * 3600 * 1000;

    private final ClipMapper clipMapper;

    public StatsService(ClipMapper clipMapper) {
        this.clipMapper = clipMapper;
    }

    public StatsResponse stats() {
        long now = System.currentTimeMillis();
        return new StatsResponse(
                clipMapper.countClips(),
                clipMapper.countVideos(),
                clipMapper.countDistinctTags(),
                clipMapper.countTags(10),
                clipMapper.countBySite(10),
                clipMapper.countTrend(now - 7 * DAY_MS),
                clipMapper.countTrend(now - 30 * DAY_MS)
        );
    }
}
