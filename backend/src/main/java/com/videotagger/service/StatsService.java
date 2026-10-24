package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import com.videotagger.mapper.TagMapper;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
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
    private final TagMapper tagMapper;

    public StatsService(ClipMapper clipMapper, MediaMapper mediaMapper, MediaFormatMapper mediaFormatMapper,
                        MediaSubcategoryMapper mediaSubcategoryMapper, TagMapper tagMapper) {
        this.clipMapper = clipMapper;
        this.mediaMapper = mediaMapper;
        this.mediaFormatMapper = mediaFormatMapper;
        this.mediaSubcategoryMapper = mediaSubcategoryMapper;
        this.tagMapper = tagMapper;
    }

    /**
     * v0.32 媒体趋势（第一部分）：筛选命中的媒体按首播年份计数。
     *
     * <p>横轴刻度规则（规格 §3.2）：`year` 维度有勾选 → 用勾选集合；无勾选 → 全库年份区间。
     * `points` 与 `years` 等长等序，**缺失年在这里补 0**（前端不做补 0）。
     *
     * <p>筛选为空时**不拦截**：照常返回全库统计（由前端决定不画）。
     */
    public StatsTrendResponse trend(List<String> status, String format, Long subcategoryId, Integer confirmed,
                                    List<Long> collectionId, List<Integer> year, String source,
                                    List<Long> tagIds, String tagMode, String genreMode, String collectionMode,
                                    String q, List<String> genres, List<String> season) {
        List<MediaMapper.YearCount> rows = mediaMapper.countTrendByYear(status, format, subcategoryId, confirmed,
                collectionId, year, source, tagIds, tagMode, genreMode, collectionMode, q, genres, season);
        Map<Integer, Long> byYear = new HashMap<>();
        long total = 0;
        for (MediaMapper.YearCount r : rows) {
            byYear.merge(r.year(), r.count(), Long::sum);
            total += r.count();
        }
        List<Integer> years = axisYears(year);
        List<StatsTrendResponse.Point> points = years.stream()
                .map(y -> new StatsTrendResponse.Point(y, byYear.getOrDefault(y, 0L)))
                .toList();
        return new StatsTrendResponse(years, total, points);
    }

    /**
     * v0.32 代表作（趋势小卡 / 视频定格）：同一套筛选 + 指定年份 + 评分口径。
     *
     * <p>`scoreSource`：`bgm`（分 + ≥100 票门槛）/ `personal`（不套门槛）/ 其余（含 null）= `mixed`（个人优先回落 Bangumi）。
     */
    public List<TrendRef> trendRefs(List<String> status, String format, Long subcategoryId, Integer confirmed,
                                    List<Long> collectionId, String source,
                                    List<Long> tagIds, String tagMode, String genreMode, String collectionMode,
                                    String q, List<String> genres, List<String> season,
                                    Integer refYear, String scoreSource, Integer limit) {
        int n = limit == null ? 5 : Math.max(1, Math.min(limit, 20));
        return mediaMapper.listTrendRefs(status, format, subcategoryId, confirmed, collectionId, source,
                tagIds, tagMode, genreMode, collectionMode, q, genres, season, refYear, scoreSource, n);
    }

    /**
     * v0.32 第二部分：每年「当年第一名」的代表作（视频里每年贴一张封面小头像）。
     *
     * <p>一条 SQL 拿全年（`ROW_NUMBER() OVER (PARTITION BY year ...)`），**不逐年查** —— 44 年就是 44 次往返，白等。
     */
    public List<MediaMapper.YearTopRef> trendYearRefs(List<String> status, String format, Long subcategoryId,
                                                      Integer confirmed, List<Long> collectionId,
                                                      List<Integer> year, String source, List<Long> tagIds,
                                                      String tagMode, String genreMode, String collectionMode,
                                                      String q, List<String> genres, List<String> season,
                                                      String scoreSource) {
        return mediaMapper.listYearTopRefs(status, format, subcategoryId, confirmed, collectionId, year, source,
                tagIds, tagMode, genreMode, collectionMode, q, genres, season, scoreSource);
    }

    /** 横轴刻度：有勾选年份 → 勾选集合（升序去重）；否则全库年份区间（连续）。 */
    private List<Integer> axisYears(List<Integer> year) {
        if (year != null && !year.isEmpty()) {
            return year.stream().distinct().sorted().toList();
        }
        MediaMapper.YearRange range = mediaMapper.yearRange();
        if (range == null || range.minYear() == null || range.maxYear() == null) {
            return List.of();
        }
        List<Integer> out = new ArrayList<>(range.maxYear() - range.minYear() + 1);
        for (int y = range.minYear(); y <= range.maxYear(); y++) {
            out.add(y);
        }
        return out;
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
                tagMapper.countAll(),
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
