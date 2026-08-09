package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
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
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

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
    private static final String DEFAULT_TITLE = "我的番剧推荐";
    private static final Map<String, String> STATUS_LABEL = Map.of(
            "WANT", "想看", "WATCHING", "在看", "DONE", "看完", "PAUSED", "搁置", "DROPPED", "弃番");

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
    private final ResourceLoader resourceLoader;

    public RecommendService(MediaService mediaService, TagMapper tagMapper,
                            MediaSubcategoryMapper mediaSubcategoryMapper,
                            MediaFormatMapper mediaFormatMapper, CoverService coverService,
                            CollectionMapper collectionMapper,
                            ObjectMapper objectMapper, ResourceLoader resourceLoader) {
        this.mediaService = mediaService;
        this.tagMapper = tagMapper;
        this.mediaSubcategoryMapper = mediaSubcategoryMapper;
        this.mediaFormatMapper = mediaFormatMapper;
        this.coverService = coverService;
        this.collectionMapper = collectionMapper;
        this.objectMapper = objectMapper;
        this.resourceLoader = resourceLoader;
    }

    /** 生成自包含推荐 HTML（标题用默认「我的番剧推荐」）。ids 空 → IllegalArgumentException。 */
    public String buildHtml(List<Long> ids) {
        return buildHtml(ids, null);
    }

    /** 生成自包含推荐 HTML（无 BGM）。 */
    public String buildHtml(List<Long> ids, String title) {
        return buildHtml(ids, title, null, null);
    }

    /** 生成自包含推荐 HTML（无分组）。 */
    public String buildHtml(List<Long> ids, String title, String bgmName, String bgmBase64) {
        return buildHtml(ids, title, bgmName, bgmBase64, null, null);
    }

    /** 生成自包含推荐 HTML（兼容旧单曲 BGM）。 */
    public String buildHtml(List<Long> ids, String title, String bgmName, String bgmBase64,
                            String groupBy, String groupStyle) {
        List<BgmTrack> tracks = (bgmBase64 == null || bgmBase64.isBlank())
                ? null
                : List.of(new BgmTrack(bgmName, bgmBase64));
        return buildHtml(ids, title, tracks, null, "md", groupBy, groupStyle);
    }

    /**
     * 生成自包含推荐 HTML（完整参数）。
     *
     * @param ids         媒体 id 列表（保持顺序），空 → IllegalArgumentException
     * @param title       推荐页标题文案（主题），空/null → 默认「我的番剧推荐」
     * @param bgmTracks   背景音乐列表（顺序连续播放），null/空 → 无 BGM
     * @param subtitle    副标题（可空；空 → 模板隐藏副题）
     * @param coverSize   开场封面大小：sm/md/lg（空 → md）
     * @param groupBy     分组维度：none/year/subcategory/collection（空 → 不分组）
     * @param groupStyle  分组呈现样式：stream/chapter/overview（空 → stream）
     */
    public String buildHtml(List<Long> ids, String title, List<BgmTrack> bgmTracks, String subtitle,
                            String coverSize, String groupBy, String groupStyle) {
        return buildHtml(ids, title, bgmTracks, subtitle, coverSize, groupBy, groupStyle, null);
    }

    public String buildHtml(List<Long> ids, String title, List<BgmTrack> bgmTracks, String subtitle,
                            String coverSize, String groupBy, String groupStyle, List<Long> openingIds) {
        return buildHtml(ids, title, bgmTracks, subtitle, coverSize, groupBy, groupStyle, openingIds, null);
    }

    public String buildHtml(List<Long> ids, String title, List<BgmTrack> bgmTracks, String subtitle,
                            String coverSize, String groupBy, String groupStyle, List<Long> openingIds,
                            String intro) {
        return buildHtml(ids, title, bgmTracks, subtitle, coverSize, groupBy, groupStyle, openingIds, intro,
                new Durations(10, 5, 5, 10, 5), null, null, null, null, null);
    }

    public String buildHtml(List<Long> ids, String title, List<BgmTrack> bgmTracks, String subtitle,
                            String coverSize, String groupBy, String groupStyle, List<Long> openingIds,
                            String intro, Durations durations, String endingTitle, String endingText,
                            String bgColor, String bgImage, String prologueTitle) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("ids 不能为空");
        }
        String resolved = (title == null || title.isBlank()) ? DEFAULT_TITLE : title.trim();
        String template = readTemplate(groupStyle);
        String slidesJson = buildSlidesJson(ids, groupBy, openingIds);
        String bgmTracksJson = buildBgmTracksJson(bgmTracks);
        String sub = (subtitle == null || subtitle.isBlank()) ? "" : esc(subtitle.trim());
        String size = normalizeCoverSize(coverSize);
        String introText = (intro == null || intro.isBlank()) ? "" : esc(intro.trim());
        String endTitle = (endingTitle == null || endingTitle.isBlank()) ? "" : esc(endingTitle.trim());
        String endText = (endingText == null || endingText.isBlank()) ? "" : esc(endingText.trim());
        String bgC = (bgColor == null || bgColor.isBlank()) ? "" : esc(bgColor.trim());
        String bgI = (bgImage == null || bgImage.isBlank()) ? "" : esc(bgImage.trim());
        String proT = (prologueTitle == null || prologueTitle.isBlank()) ? "" : esc(prologueTitle.trim());
        Durations dur = normalizeDurations(durations);
        return template
                .replace("__TITLE__", esc(resolved))
                .replace("__SLIDES_JSON__", slidesJson)
                .replace("__SUBTITLE__", sub)
                .replace("__COVER_SIZE__", size)
                .replace("__INTRO__", introText)
                .replace("__ENDING_TITLE__", endTitle)
                .replace("__ENDING_TEXT__", endText)
                .replace("__BG_COLOR__", bgC)
                .replace("__BG_IMAGE__", bgI)
                .replace("__PROLOGUE_TITLE__", proT)
                .replace("__OPENING_SEC__", String.valueOf(dur.opening()))
                .replace("__INTRO_SEC__", String.valueOf(dur.intro()))
                .replace("__DETAIL_SEC__", String.valueOf(dur.detail()))
                .replace("__GROUP_SEC__", String.valueOf(dur.group()))
                .replace("__ENDING_SEC__", String.valueOf(dur.ending()))
                .replace("__BGM_TRACKS__", bgmTracksJson)
                .replace("__BGM_SRC__", "")
                .replace("__BGM_NAME__", "");
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

    /** 背景音乐列表 → 模板注入 JSON：[{name, src(dataURI)}]。空 → []. */
    private String buildBgmTracksJson(List<BgmTrack> bgmTracks) {
        List<Map<String, Object>> arr = new ArrayList<>();
        if (bgmTracks != null) {
            for (BgmTrack t : bgmTracks) {
                if (t == null || t.base64() == null || t.base64().isBlank()) {
                    continue;
                }
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", esc(t.name() == null ? "" : t.name()));
                m.put("src", "data:" + bgmMime(t.name()) + ";base64," + t.base64());
                arr.add(m);
            }
        }
        try {
            return objectMapper.writeValueAsString(arr);
        } catch (IOException e) {
            return "[]";
        }
    }

    /** 封面大小归一化：未知/空 → md。 */
    private static String normalizeCoverSize(String coverSize) {
        if (coverSize == null || coverSize.isBlank()) {
            return "md";
        }
        String s = coverSize.trim().toLowerCase();
        return switch (s) {
            case "sm", "lg" -> s;
            default -> "md";
        };
    }

    /** 按 BGM 文件名推断音频 mime（未知 → audio/mpeg）。 */
    private static String bgmMime(String name) {
        if (name != null) {
            String lower = name.toLowerCase();
            if (lower.endsWith(".m4a")) return "audio/mp4";
            if (lower.endsWith(".wav")) return "audio/wav";
            if (lower.endsWith(".ogg")) return "audio/ogg";
        }
        return "audio/mpeg";
    }

    private String buildSlidesJson(List<Long> ids, String groupBy, List<Long> openingIds) {
        List<Map<String, Object>> slides = new ArrayList<>();
        for (Long id : ids) {
            MediaDetail d;
            try {
                d = mediaService.get(id);
            } catch (RuntimeException e) {
                log.warn("推荐跳过不存在的媒体 {}: {}", id, e.getMessage());
                continue; // 残留勾选 → 跳过不报错
            }
            slides.add(slideOf(d, groupBy, openingIds));
        }
        if (groupBy != null && !groupBy.isBlank() && !"none".equals(groupBy)) {
            slides = groupOrdered(slides, groupBy);
        }
        try {
            return objectMapper.writeValueAsString(slides);
        } catch (IOException e) {
            throw new IllegalStateException("序列化推荐数据失败", e);
        }
    }

    /** 真实分组数（与 buildSlidesJson 同一套 groupOf/分组口径）——视频导出时长按此精确计算章节转场。 */
    public int computeGroupCount(List<Long> ids, String groupBy) {
        if (groupBy == null || groupBy.isBlank() || "none".equals(groupBy)) {
            return 0;
        }
        java.util.Set<String> groups = new java.util.LinkedHashSet<>();
        for (Long id : ids) {
            MediaDetail d;
            try {
                d = mediaService.get(id);
            } catch (RuntimeException e) {
                continue; // 与 buildSlidesJson 一致：缺失媒体跳过
            }
            String g = groupOf(d, groupBy);
            groups.add(g == null ? "未分组" : g);
        }
        return groups.size();
    }

    private Map<String, Object> slideOf(MediaDetail d, String groupBy, List<Long> openingIds) {
        Map<String, Object> slide = new LinkedHashMap<>();
        slide.put("cover", resolveCoverDataUrl(d));
        slide.put("cat", buildCategory(d));
        slide.put("title", esc(d.title()));
        slide.put("note", esc(d.note() == null || d.note().isBlank() ? "（暂无备注）" : d.note().trim()));
        slide.put("flag", STATUS_LABEL.getOrDefault(d.status(), d.status() == null ? "" : d.status()));
        slide.put("tags", buildTags(d.id()));
        String group = groupOf(d, groupBy);
        if (group != null) {
            slide.put("group", group);
        }
        /* 开场代表秀：命中 openingIds → open 标记（模板开场只显影这些；空 openingIds → 不标记 = 开场全显） */
        if (openingIds != null && openingIds.contains(d.id())) {
            slide.put("open", true);
        }
        return slide;
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

    /** 按组排序：year 组按年份数字降序（未知年份排最后）；其余维度按首次出现顺序；组内保持原序。 */
    private List<Map<String, Object>> groupOrdered(List<Map<String, Object>> slides, String groupBy) {
        Map<String, List<Map<String, Object>>> groups = new LinkedHashMap<>();
        for (Map<String, Object> s : slides) {
            String g = (String) s.get("group");
            groups.computeIfAbsent(g == null ? "未分组" : g, k -> new ArrayList<>()).add(s);
        }
        List<String> keys = new ArrayList<>(groups.keySet());
        if ("year".equals(groupBy)) {
            keys.sort((a, b) -> {
                int an = yearOf(a), bn = yearOf(b);
                if (an == Integer.MIN_VALUE && bn == Integer.MIN_VALUE) return a.compareTo(b);
                if (an == Integer.MIN_VALUE) return 1;
                if (bn == Integer.MIN_VALUE) return -1;
                return Integer.compare(bn, an);
            });
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (String k : keys) out.addAll(groups.get(k));
        return out;
    }

    /** 「2024 年」→ 2024；无法解析 → Integer.MIN_VALUE（排最后）。 */
    private static int yearOf(String group) {
        String y = group.replace(" 年", "").trim();
        try {
            return Integer.parseInt(y);
        } catch (NumberFormatException e) {
            return Integer.MIN_VALUE;
        }
    }

    /** 封面 base64：coverPath 优先，失败降级 fallbackCoverPath；再失败无封面（模板 onerror 隐藏）。 */
    private String resolveCoverDataUrl(MediaDetail d) {
        String data = coverService.base64ForCoverPath(d.coverPath());
        if (data != null) {
            return data;
        }
        return coverService.base64ForCoverPath(d.fallbackCoverPath());
    }

    /** 分类行：格式名（如「番剧」）+ 子分类路径（父 / 子）。 */
    private String buildCategory(MediaDetail d) {
        String fmt = formatName(d.mediaFormat());
        String sub = subcategoryPath(d.subcategoryId(), d.subcategory());
        if (sub == null || sub.isBlank()) {
            return esc(fmt);
        }
        return esc(fmt.isBlank() ? sub : fmt + " · " + sub);
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
            tags.add(List.of(esc(u.name()), u.refCount()));
        }
        return tags;
    }

    private String formatName(String code) {
        if (code == null || code.isBlank()) {
            return "";
        }
        MediaFormat mf = mediaFormatMapper.selectOne(
                new QueryWrapper<MediaFormat>().eq("code", code).last("LIMIT 1"));
        return mf != null ? mf.getName() : code;
    }

    private String readTemplate(String groupStyle) {
        String style = normalizeStyle(groupStyle);
        try (var in = resourceLoader.getResource("classpath:templates/recommend-" + style + ".html").getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("读取推荐模板失败: recommend-" + style + ".html", e);
        }
    }

    /** 分组样式归一化：未知/空 → stream（默认流式横幅）。 */
    private static String normalizeStyle(String groupStyle) {
        if (groupStyle == null || groupStyle.isBlank()) {
            return "stream";
        }
        String s = groupStyle.trim().toLowerCase();
        return switch (s) {
            case "chapter", "overview" -> s;
            default -> "stream";
        };
    }

    /** HTML 转义：标题/分类/备注/标签名含 <>&" 会破坏模板结构，进 JSON 前先转义。 */
    private static String esc(String s) {
        return s == null ? "" : HtmlUtils.htmlEscape(s);
    }
}
