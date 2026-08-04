package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StatsService {

    private static final long DAY_MS = 24L * 3600 * 1000;

    private final ClipMapper clipMapper;
    private final MediaMapper mediaMapper;
    private final MediaFormatMapper mediaFormatMapper;

    public StatsService(ClipMapper clipMapper, MediaMapper mediaMapper, MediaFormatMapper mediaFormatMapper) {
        this.clipMapper = clipMapper;
        this.mediaMapper = mediaMapper;
        this.mediaFormatMapper = mediaFormatMapper;
    }

    public StatsResponse stats() {
        long now = System.currentTimeMillis();
        List<StatsResponse.MediaFormatStat> byFormat = mediaMapper.countGroupByFormat().stream()
                .map(r -> new StatsResponse.MediaFormatStat(r.format(), nameOfFormat(r.format()), r.count()))
                .toList();
        List<StatsResponse.SubcategoryStat> bySub = mediaMapper.countGroupBySubcategory().stream()
                .map(r -> new StatsResponse.SubcategoryStat(r.subcategory(), r.count()))
                .toList();
        return new StatsResponse(
                clipMapper.countClips(),
                clipMapper.countVideos(),
                clipMapper.countDistinctTags(),
                clipMapper.countTags(10),
                clipMapper.countBySite(10),
                clipMapper.countTrend(now - 7 * DAY_MS),
                clipMapper.countTrend(now - 30 * DAY_MS),
                byFormat,
                bySub
        );
    }

    private String nameOfFormat(String code) {
        MediaFormat mf = mediaFormatMapper.selectOne(new QueryWrapper<MediaFormat>().eq("code", code));
        return mf != null ? mf.getName() : code;
    }
}
