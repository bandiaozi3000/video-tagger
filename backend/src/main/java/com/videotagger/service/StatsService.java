package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class StatsService {

    private static final long DAY_MS = 24L * 3600 * 1000;

    private final ClipMapper clipMapper;
    private final MediaMapper mediaMapper;
    private final MediaFormatMapper mediaFormatMapper;
    private final MediaSubcategoryMapper mediaSubcategoryMapper;

    public StatsService(ClipMapper clipMapper, MediaMapper mediaMapper, MediaFormatMapper mediaFormatMapper,
                        MediaSubcategoryMapper mediaSubcategoryMapper) {
        this.clipMapper = clipMapper;
        this.mediaMapper = mediaMapper;
        this.mediaFormatMapper = mediaFormatMapper;
        this.mediaSubcategoryMapper = mediaSubcategoryMapper;
    }

    public StatsResponse stats() {
        long now = System.currentTimeMillis();
        List<StatsResponse.MediaFormatStat> byFormat = mediaMapper.countGroupByFormat().stream()
                .map(r -> new StatsResponse.MediaFormatStat(r.format(), nameOfFormat(r.format()), r.count()))
                .toList();
        Map<Long, MediaSubcategory> subById = mediaSubcategoryMapper.listAll().stream()
                .collect(Collectors.toMap(MediaSubcategory::getId, Function.identity()));
        List<StatsResponse.SubcategoryStat> bySub = mediaMapper.countGroupBySubcategory().stream()
                .map(r -> new StatsResponse.SubcategoryStat(r.subcategoryId(),
                        pathLabel(r.subcategoryId(), subById), r.count()))
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

    /** 节点到根的路径 label（父 / 子），跨分支重名可区分。 */
    private String pathLabel(Long id, Map<Long, MediaSubcategory> byId) {
        StringBuilder sb = new StringBuilder();
        MediaSubcategory cur = byId.get(id);
        while (cur != null) {
            if (sb.length() > 0) {
                sb.insert(0, " / ");
            }
            sb.insert(0, cur.getName());
            cur = byId.get(cur.getParentId());
        }
        return sb.isEmpty() ? String.valueOf(id) : sb.toString();
    }
}
