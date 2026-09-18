package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Collection;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.CollectionMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import com.videotagger.mapper.TagMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 推荐番剧 → 自包含渐变环流 HTML。
 *
 * 流程：按 ids 顺序逐个取媒体 → 封面 base64（coverPath 优先，fallbackCoverPath 降级）→
 * 分类路径（格式名 + 子分类「父 / 子」）→ 备注/状态/标签热度 → 替换模板
 * {@code __SLIDES_JSON__} 占位符 → 返回完整单文件 HTML（无外部依赖，可发送/手机打开）。
 */
@Service
public class RecommendService {

    private static final Logger log = LoggerFactory.getLogger(RecommendService.class);
    private static final int MAX_TAG_COUNT = 6;
    private static final int SUB_CATEGORY_DEPTH = 10;

    /** 一首背景音乐：名称 + base64（无 data: 前缀）。 */
    public record BgmTrack(String name, String base64) {
    }

    /** 显示时长（秒）：开局定格 / 序言 / 章节转场 / 每部详情 / 结尾。 */
    public record Durations(int opening, int intro, int group, int detail, int ending) {
    }

    private final MediaService mediaService;
    private final TagMapper tagMapper;
    private final MediaSubcategoryMapper mediaSubcategoryMapper;
    private final MediaFormatMapper mediaFormatMapper;
    private final CoverService coverService;
    private final CollectionMapper collectionMapper;
    private final ObjectMapper objectMapper;

    public RecommendService(MediaService mediaService, TagMapper tagMapper,
                            MediaSubcategoryMapper mediaSubcategoryMapper,
                            MediaFormatMapper mediaFormatMapper, CoverService coverService,
                            CollectionMapper collectionMapper,
                            ObjectMapper objectMapper) {
        this.mediaService = mediaService;
        this.tagMapper = tagMapper;
        this.mediaSubcategoryMapper = mediaSubcategoryMapper;
        this.mediaFormatMapper = mediaFormatMapper;
        this.coverService = coverService;
        this.collectionMapper = collectionMapper;
        this.objectMapper = objectMapper;
    }

    /** 速度滑块归一化：0-100，空/越界 → 50（当前速度）。 */
    private static int clampSpeed(Integer v) {
        return v == null ? 50 : Math.max(0, Math.min(100, v));
    }

    /** 显示时长归一化：空/越界 → 默认（开局 10 / 序言 5 / 章节 5 / 详情 10 / 结尾 5）。 */
    public Durations normalizeDurations(Integer opening, Integer intro, Integer group, Integer detail, Integer ending) {
        return new Durations(
                clamp(opening, 2, 20, 10),
                clamp(intro, 1, 10, 5),
                clamp(group, 1, 10, 5),
                clamp(detail, 3, 15, 10),
                clamp(ending, 1, 10, 5));
    }

    private Durations normalizeDurations(Durations d) {
        return d == null ? new Durations(10, 5, 5, 10, 5) : d;
    }

    private static int clamp(Integer v, int min, int max, int dft) {
        if (v == null) return dft;
        return Math.max(min, Math.min(max, v));
    }

    /** 封面大小归一化：0-100 数值（滑块），空/非法 → 50（= 中档，模板按此算缩放系数）。 */
    private static String normalizeCoverSize(String coverSize) {
        if (coverSize == null || coverSize.isBlank()) {
            return "50";
        }
        try {
            int v = Integer.parseInt(coverSize.trim());
            return String.valueOf(Math.max(0, Math.min(100, v)));
        } catch (NumberFormatException e) {
            return "50";
        }
    }

    /** 模板形态：`clip` → 片段优先；其余（含 chapter/stream/overview/空）→ 章节叙事。 */
    public static String styleOf(String groupStyle) {
        return "clip".equals(normalizeStyle(groupStyle)) ? "clip" : "chapter";
    }

    /**
     * 组装 Remotion 渲染输入（生产链路：Java → Node renderer）。
     *
     * 与已退役的 {@code buildHtml} 的区别：输出的是给 Remotion 的 JSON（不注入 HTML），
     * 封面用 embed 模式的 data URI（不把外部 URL 交给 Remotion），
     * 片段/BGM 用已准备的本地相对路径（相对工作目录，即 Node 侧的 --asset-root）。
     *
     * @param bgmAssetPaths BGM 素材相对路径（与 bgmTracks 一一对应；用于 Remotion 内建混音）
     * @param probeSeconds  素材时长探测（入参为工作目录相对的素材路径，返回秒）
     */
    public String buildRenderInput(List<Long> ids, String title, List<BgmTrack> bgmTracks, String subtitle,
                                  String coverSize, String groupBy, String groupStyle, List<Long> openingIds,
                                  String intro, Durations durations, String endingTitle, String endingText,
                                  String bgColor, List<String> bgImages, Integer bgRotationSec, Integer bgOpacity,
                                  Integer bgBlur, Integer bgBrightness, String prologueTitle, String groupSort,
                                  Integer openingSpeed, Integer endingScrollSpeed, Integer bgmScale, Integer bgmX,
                                  Integer bgmY, String brandTitle, Integer perScreen,
                                  Map<String, Boolean> detailShow, String preset,
                                  Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips,
                                  String coverMode, int fps, int width, int height,
                                  List<String> bgmAssetPaths,
                                  java.util.function.ToDoubleFunction<String> probeSeconds) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("ids 不能为空");
        }
        Durations dur = normalizeDurations(durations);
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("template", "MULTI_MEDIA_RECOMMEND");
        root.put("style", styleOf(groupStyle));
        root.put("title", title == null ? "" : title.trim());
        root.put("subtitle", subtitle == null ? "" : subtitle.trim());
        root.put("intro", intro == null ? "" : intro.trim());

        List<Map<String, Object>> mediaViews = new ArrayList<>();
        int order = 0;
        for (Long id : ids) {
            MediaDetail d;
            try {
                d = mediaService.get(id);
            } catch (RuntimeException e) {
                log.warn("Remotion 输入跳过不存在的媒体 {}: {}", id, e.getMessage());
                continue;
            }
            order++;
            List<RecommendClipSourceService.PreparedClip> clips =
                    preparedClips == null ? null : preparedClips.get(id);
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("mediaId", d.id());
            view.put("order", order);
            view.put("mode", (clips == null || clips.isEmpty()) ? "INFO_ONLY" : "CLIPS_SELECTED");
            view.put("title", d.title() == null ? "" : d.title());
            if (d.originalTitle() != null && !d.originalTitle().isBlank()) view.put("originalTitle", d.originalTitle());
            if (d.year() != null) view.put("year", d.year());
            if (d.season() != null) view.put("season", d.season());
            // 封面：渲染用 embed（data URI，无头环境自足）；浏览器预览用 url（/covers/x.jpg，宿主直接托管）
            String cover = resolveCoverDataUrl(d, coverMode == null || coverMode.isBlank() ? "embed" : coverMode);
            if (cover != null && !cover.isBlank()) view.put("coverAssetPath", cover);
            view.put("description", d.note() == null ? "" : d.note().trim());
            List<String> tagNames = new ArrayList<>();
            for (List<Object> tag : buildTags(d.id())) {
                if (!tag.isEmpty() && tag.get(0) != null) tagNames.add(String.valueOf(tag.get(0)));
            }
            view.put("tags", tagNames);
            // 分组名（Remotion 侧据此排章节页与组序）
            String groupName = groupOf(d, groupBy);
            if (groupName != null) view.put("group", groupName);

            List<Map<String, Object>> clipViews = new ArrayList<>();
            if (clips != null) {
                for (RecommendClipSourceService.PreparedClip clip : clips) {
                    Map<String, Object> cv = new LinkedHashMap<>();
                    cv.put("clipId", clip.id());
                    cv.put("title", clip.title() == null || clip.title().isBlank() ? "未命名片段" : clip.title());
                    if (clip.note() != null && !clip.note().isBlank()) cv.put("note", clip.note());
                    cv.put("assetPath", clip.path());
                    if (clip.startSec() != null) cv.put("sourceStartMs", Math.round(clip.startSec() * 1000));
                    cv.put("durationMs", clipDurationMs(clip, probeSeconds));
                    // 已准备素材保留原声（RecommendClipSourceService 不再 -an）；无音轨素材自然不会出声
                    cv.put("hasAudio", true);
                    clipViews.add(cv);
                }
            }
            view.put("clips", clipViews);
            mediaViews.add(view);
        }
        if (mediaViews.isEmpty()) {
            throw new IllegalArgumentException("没有可用媒体（全部不存在或已删除）");
        }
        root.put("media", mediaViews);

        Map<String, Object> p = new LinkedHashMap<>();
        p.put("title", title == null ? "" : title.trim());
        p.put("brandTitle", brandTitle == null ? "" : brandTitle.trim());
        p.put("subtitle", subtitle == null ? "" : subtitle.trim());
        p.put("intro", intro == null ? "" : intro.trim());
        p.put("prologueTitle", prologueTitle == null ? "" : prologueTitle.trim());
        p.put("endingTitle", endingTitle == null ? "" : endingTitle.trim());
        p.put("endingText", endingText == null ? "" : endingText.trim());
        p.put("coverSize", Integer.parseInt(normalizeCoverSize(coverSize)));
        Map<String, Object> show = new LinkedHashMap<>();
        show.put("status", detailShow == null || detailShow.get("status") == null || detailShow.get("status"));
        show.put("note", detailShow == null || detailShow.get("note") == null || detailShow.get("note"));
        show.put("tag", detailShow == null || detailShow.get("tag") == null || detailShow.get("tag"));
        p.put("detailShow", show);
        p.put("bgColor", bgColor == null ? "" : bgColor.trim());
        p.put("bgImages", bgImages == null ? List.of() : bgImages);
        p.put("bgRotationSec", clamp(bgRotationSec, 1, 60, 8));
        p.put("bgOpacity", clamp(bgOpacity, 0, 100, 100));
        p.put("bgBlur", clamp(bgBlur, 0, 100, 0));
        p.put("bgBrightness", clamp(bgBrightness, 0, 100, 50));
        List<Map<String, Object>> bgmViews = new ArrayList<>();
        if (bgmTracks != null) {
            for (int i = 0; i < bgmTracks.size(); i++) {
                BgmTrack t = bgmTracks.get(i);
                if (t == null || t.name() == null || t.name().isBlank()) continue;
                Map<String, Object> tv = new LinkedHashMap<>();
                tv.put("name", t.name());
                String rel = bgmAssetPaths != null && i < bgmAssetPaths.size() ? bgmAssetPaths.get(i) : null;
                if (rel != null && !rel.isBlank()) {
                    tv.put("assetPath", rel);
                    // 曲长用于 BGM 条时间轴与 ducking 时段；探不到 → 0，Remotion 侧按均分兜底
                    double seconds = probeSeconds.applyAsDouble(rel);
                    tv.put("durationSec", seconds > 0 ? Math.round(seconds * 1000) / 1000.0 : 0);
                }
                bgmViews.add(tv);
            }
        }
        p.put("bgmTracks", bgmViews);
        p.put("bgmScale", clamp(bgmScale, 50, 200, 100));
        p.put("bgmX", clamp(bgmX, 0, 100, 1));
        p.put("bgmY", clamp(bgmY, 0, 100, 8));
        p.put("openingSpeed", clampSpeed(openingSpeed));
        p.put("endingScrollSpeed", clampSpeed(endingScrollSpeed));
        Map<String, Object> durs = new LinkedHashMap<>();
        durs.put("opening", dur.opening());
        durs.put("intro", dur.intro());
        durs.put("group", dur.group());
        durs.put("detail", dur.detail());
        durs.put("ending", dur.ending());
        p.put("durations", durs);
        p.put("fps", fps);
        p.put("width", width);
        p.put("height", height);
        // 分组/每屏：Remotion 侧已消费（章节页 + 一屏 N 部网格），不再是「透传但不生效」
        p.put("groupBy", groupBy == null ? "" : groupBy);
        p.put("groupSort", groupSort == null || groupSort.isBlank() ? "date-desc" : groupSort);
        p.put("perScreen", perScreen == null ? 1 : Math.max(1, Math.min(10, perScreen)));
        p.put("preset", preset == null || preset.isBlank() ? "starlit" : preset.trim());
        p.put("openingIds", openingIds == null ? List.of() : openingIds);
        root.put("params", p);

        try {
            return objectMapper.writeValueAsString(root);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("生成 Remotion 渲染输入失败: " + e.getMessage(), e);
        }
    }

    /** 片段时长（毫秒）：已知起止 → 直接算；开放时长 → 探测已准备素材。 */
    private long clipDurationMs(RecommendClipSourceService.PreparedClip clip,
                                java.util.function.ToDoubleFunction<String> probeSeconds) {
        if (clip.startSec() != null && clip.endSec() != null && clip.endSec() > clip.startSec()) {
            return Math.round((clip.endSec() - clip.startSec()) * 1000);
        }
        try {
            double seconds = probeSeconds.applyAsDouble(clip.path());
            if (seconds > 0) return Math.round(seconds * 1000);
        } catch (RuntimeException e) {
            log.warn("片段时长探测失败 {}: {}", clip.path(), e.getMessage());
        }
        throw new IllegalStateException("片段时长不可用（开放时长且探测失败）: " + clip.path());
    }

    /** 分组维度取值：year → 「年份 年」；subcategory → 子分类路径；collection → 首个收藏夹名；none/未知 → null。 */
    private String groupOf(MediaDetail d, String groupBy) {
        if (groupBy == null || groupBy.isBlank() || "none".equals(groupBy)) {
            return null;
        }
        return switch (groupBy) {
            case "year" -> d.year() == null ? "未知年份" : d.year() + " 年";
            case "subcategory" -> {
                String sub = subcategoryPath(d.subcategoryId(), d.subcategory());
                yield sub == null || sub.isBlank() ? "未分类" : sub;
            }
            case "collection" -> {
                String name = null;
                if (d.collectionIds() != null) {
                    for (Long cid : d.collectionIds()) {
                        Collection c = collectionMapper.selectById(cid);
                        if (c != null && c.getName() != null && !c.getName().isBlank()) {
                            name = c.getName();
                            break; // 取首个收藏夹名（按 collection_id 排序）
                        }
                    }
                }
                yield name == null || name.isBlank() ? "未收藏" : name;
            }
            default -> null;
        };
    }

    /** 封面地址：url 模式 → 相对 /covers/ 路径（预览同源直连、零内嵌）；embed 模式 → base64 data URI（离线自包含）。 */
    private String resolveCoverDataUrl(MediaDetail d, String coverMode) {
        if ("url".equals(coverMode)) {
            String path = d.coverPath();
            return (path == null || path.isBlank()) ? d.fallbackCoverPath() : path;
        }
        String data = coverService.base64ForCoverPath(d.coverPath());
        if (data != null) {
            return data;
        }
        return coverService.base64ForCoverPath(d.fallbackCoverPath());
    }

    /** 子分类路径：按 subcategoryId 递归父节点拼「父 / 子」，深度上限防环；失败回退名字快照。 */
    private String subcategoryPath(Long subcategoryId, String snapshot) {
        if (subcategoryId == null || subcategoryId <= 0) {
            return snapshot;
        }
        List<String> names = new ArrayList<>();
        MediaSubcategory cur = mediaSubcategoryMapper.selectById(subcategoryId);
        int depth = 0;
        while (cur != null && depth < SUB_CATEGORY_DEPTH) {
            names.add(0, cur.getName());
            Long parent = cur.getParentId();
            if (parent == null || parent <= 0) {
                break;
            }
            cur = mediaSubcategoryMapper.selectById(parent);
            depth++;
        }
        if (names.isEmpty()) {
            return snapshot;
        }
        return String.join(" / ", names);
    }

    /** 标签热度：countByMedia 过滤 refCount>0，取前 N（次数降序）。 */
    private List<List<Object>> buildTags(Long mediaId) {
        List<List<Object>> tags = new ArrayList<>();
        for (TagUsage u : tagMapper.countByMedia(mediaId)) {
            if (tags.size() >= MAX_TAG_COUNT) {
                break;
            }
            if (u.refCount() <= 0) {
                continue;
            }
            tags.add(List.of(u.name() == null ? "" : u.name(), u.refCount()));
        }
        return tags;
    }


    /** 推荐模板归一化：chapter/clip 为正式模板；历史 stream/overview 回退到 chapter。 */
    private static String normalizeStyle(String groupStyle) {
        if (groupStyle == null || groupStyle.isBlank()) {
            return "chapter";
        }
        String s = groupStyle.trim().toLowerCase();
        return switch (s) {
            case "chapter", "clip" -> s;
            case "stream", "overview" -> "chapter";
            default -> "chapter";
        };
    }

}
