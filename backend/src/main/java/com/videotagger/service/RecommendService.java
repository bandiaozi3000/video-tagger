package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Collection;
import com.videotagger.entity.Episode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.CollectionMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaCollectionMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaMapper;
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
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
    public record Durations(int opening, int intro, int group, int detail, int ending, int title) {
    }

    /**
     * 每部媒体的**用户标注**：推荐等级名次 + 推荐理由（对应编辑器 `EditorConfig.mediaMarks`）。
     *
     * <p>`tier` 是**名次**（0 = 最强 = 「强推」；名单写死在 Remotion 侧 `RECOMMEND_TIERS`，后端不参与配置）；
     * 缺省/null = 最低档（默认卡片）。`tier == 0` 接管了原来的 ★ 重点（组首核心区 + 结尾全片回顾）。
     */
    public record MediaMark(Integer tier, String reason) {
    }

    private final MediaService mediaService;
    private final MediaMapper mediaMapper;
    private final MediaCollectionMapper mediaCollectionMapper;
    private final TagMapper tagMapper;
    private final MediaSubcategoryMapper mediaSubcategoryMapper;
    private final MediaFormatMapper mediaFormatMapper;
    private final CoverService coverService;
    private final CollectionMapper collectionMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final EpisodeMapper episodeMapper;
    private final ClipMapper clipMapper;
    private final ObjectMapper objectMapper;

    public RecommendService(MediaService mediaService, MediaMapper mediaMapper,
                            MediaCollectionMapper mediaCollectionMapper, TagMapper tagMapper,
                            MediaSubcategoryMapper mediaSubcategoryMapper,
                            MediaFormatMapper mediaFormatMapper, CoverService coverService,
                            CollectionMapper collectionMapper,
                            ExternalWorkMapper externalWorkMapper,
                            EpisodeMapper episodeMapper,
                            ClipMapper clipMapper,
                            ObjectMapper objectMapper) {
        this.mediaService = mediaService;
        this.mediaMapper = mediaMapper;
        this.mediaCollectionMapper = mediaCollectionMapper;
        this.tagMapper = tagMapper;
        this.mediaSubcategoryMapper = mediaSubcategoryMapper;
        this.mediaFormatMapper = mediaFormatMapper;
        this.coverService = coverService;
        this.collectionMapper = collectionMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.episodeMapper = episodeMapper;
        this.clipMapper = clipMapper;
        this.objectMapper = objectMapper;
    }

    /** 速度滑块归一化：0-100，空/越界 → 50（当前速度）。 */
    private static int clampSpeed(Integer v) {
        return v == null ? 50 : Math.max(0, Math.min(100, v));
    }

    /** 显示时长归一化：空/越界 → 默认（开局 10 / 序言 5 / 章节 5 / 详情 10 / 结尾 5）。 */
    public Durations normalizeDurations(Integer opening, Integer intro, Integer group, Integer detail, Integer ending, Integer title) {
        // 只留下限、上不封顶（用户 2026-09-26：「显示时长无限制可自由发挥」）；`MAX_SEGMENT_SEC` 防手滑。
        // 与 Remotion 侧 `src/params.ts` 的同名常量保持一致（两处改一起改）。
        return new Durations(
                clamp(opening, 2, MAX_SEGMENT_SEC, 10),
                clamp(intro, 1, MAX_SEGMENT_SEC, 5),
                clamp(group, 1, MAX_SEGMENT_SEC, 5),
                clamp(detail, 3, MAX_SEGMENT_SEC, 10),
                clamp(ending, 1, MAX_SEGMENT_SEC, 5),
                clamp(title, 1, MAX_SEGMENT_SEC, 2));
    }

    /** 单段时长的兑底上限（秒）：仅防手滑，不是产品限制。 */
    private static final int MAX_SEGMENT_SEC = 600;

    private Durations normalizeDurations(Durations d) {
        return d == null ? new Durations(10, 5, 5, 10, 5, 2) : d;
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
        String style = normalizeStyle(groupStyle);
        // cinema = 「银幕式」模板（v0.29 期间新增），与旧 chapter/clip **并存**（旧版一行未改）
        return "cinema".equals(style) ? "cinema" : ("clip".equals(style) ? "clip" : "chapter");
    }

    /**
     * 时间轴帧率（用户 2026-09-20 拍板）：
     *
     * <ul>
     *   <li><b>银幕式 → 24</b>：番剧片段素材实测清一色 23.976fps，24fps 时间轴下每帧都落在素材真帧上，
     *       <b>不再需要每 5 帧补一张停住的重复帧</b>（那正是“片段画面在抖”的根因），素材还可零重编码直通。</li>
     *   <li><b>其余模板 → 30</b>：旧版行为一字不变。</li>
     * </ul>
     *
     * 注意：一个输出文件只能有一个帧率，“片段 24 + 其余 30”在编码层面不存在；
     * 24 vs 23.976 的 0.1% 差异 = 约每 42 秒才补 1 帧，肉眼不可见。
     */
    public static int fpsOf(String groupStyle) {
        return "cinema".equals(styleOf(groupStyle)) ? 24 : 30;
    }

    /**
     * 素材信息指纹：只覆盖**影响观看的展示字段**（标题/年份/格式/分类/来源/封面链/简介/标签/集数）。
     *
     * 用途：编辑器在切回窗口时比一次，变了就重建会话（用户 2026-09-20 的 A+B）。
     * **刻意不含**：片段素材路径、会话工作目录、强调色（那些由会话自己生成，与“库里资料有无更新”无关）。
     * 只读 media / external_work / media_tag 三张表，**不读封面文件也不探测视频** —— 要能在 focus 里频繁调用。
     */
    public String metaFingerprint(List<Long> ids) {
        // 批量取（2026-09-26）：以前这里也是 `for (id) mediaService.get(id)` = 8 条 SQL/部，
        // 而它是**每次渲染输入都要算**的 —— 等于把刚批量化掉的开销又付一遍。
        return fingerprintOf(ids, loadRenderMedia(ids));
    }

    /**
     * 指纹正文。字段与顺序沿用旧实现（渲染输入与 `/meta-fingerprint` 共用）。
     *
     * ⚠️ 与旧实现的一处差异：标签用的是 {@link #loadRenderMedia} 已取的
     * 「media ∪ episode ∪ clip，最多 {@link #MAX_TAG_COUNT} 个、跳过零引用」那组，
     * 而旧的是 `media_tag` 单表全量。二者对「库里改没改过资料」同样敏感；
     * 极端情况下（改动落在第 7 个以后的标签上）指纹不变，可用工具栏的「重新读取素材」手动重建。
     */
    private String fingerprintOf(List<Long> ids, List<RenderMedia> loaded) {
        if (ids == null || ids.isEmpty()) return "-";
        StringBuilder raw = new StringBuilder();
        int cursor = 0;
        for (Long id : ids) {
            if (id == null) continue;
            // 两边同序：下一个已加载的 id 对不上就说明这个 id 缺失
            RenderMedia d = cursor < loaded.size() && id.equals(loaded.get(cursor).id()) ? loaded.get(cursor++) : null;
            if (d == null) {
                raw.append(id).append('\u0001').append("missing");
                continue;
            }
            raw.append(d.id()).append('\u0001').append(d.title()).append('\u0001').append((String) null)
                    .append('\u0001').append(d.aliases()).append('\u0001').append(d.year()).append('\u0001')
                    .append(d.season()).append('\u0001').append(d.mediaFormat()).append('\u0001')
                    .append(d.subcategory()).append('\u0001').append(d.note()).append('\u0001')
                    .append(d.status()).append('\u0001').append(d.rating()).append('\u0001')
                    .append(d.coverPath()).append('\u0001').append(d.fallbackCoverPath()).append('\u0001')
                    .append(d.externalCoverUrl()).append('\u0001').append(d.episodeRows()).append('\u0001')
                    .append(d.clipCount()).append('\u0001').append(d.provider());
            for (String tag : d.tagNames()) {
                raw.append('\u0002').append(tag);
            }
        }
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(raw.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (java.security.NoSuchAlgorithmException e) {
            return Integer.toHexString(raw.toString().hashCode());
        }

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
                                  String coverSize, String groupBy, String groupStyle, List<Long> openingIds, Map<Long, RecommendService.MediaMark> mediaMarks,
                                  String intro, Durations durations, String endingTitle, String endingText,
                                  String bgColor, List<String> bgImages, Integer bgRotationSec, Integer bgOpacity,
                                  Integer bgBlur, Integer bgBrightness, String prologueTitle, String groupSort,
                                  Integer openingSpeed, Integer endingScrollSpeed, Integer bgmScale, Integer bgmX,
                                  Integer bgmY, String brandTitle, Integer perScreen,
                                  Map<String, Boolean> detailShow, String preset,
                                  Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips,
                                  String coverMode, int fps, int width, int height,
                                  List<String> bgmAssetPaths,
                                  java.util.function.ToDoubleFunction<String> probeSeconds,
                                  Integer seed,
                                  Integer clipVolume, String bgmRange, String stingPath, Integer stingVolume,
                                  Boolean tierGroup) {
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
        // 先把媒体取出来（顺带**并发预热 Bangumi 封面**：几十张串行下载会让首次预览/渲染卡十几秒）
        // 批量取（2026-09-26）：以前这里是 `for (id) mediaService.get(id)` = 18 条 SQL/部
        List<RenderMedia> details = loadRenderMedia(ids);
        warmExternalCovers(details);
        GroupContext groupCtx = loadGroupContext();
        // 主色**只有银幕式用**（"每部一色"）：其余模板跳过 —— 它要解码整张封面，是全选后卡顿的大头之一
        boolean needsAccent = "cinema".equals(styleOf(groupStyle));
        int order = 0;
        for (RenderMedia d : details) {
            order++;
            List<RecommendClipSourceService.PreparedClip> clips =
                    preparedClips == null ? null : preparedClips.get(d.id());
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("mediaId", d.id());
            view.put("order", order);
            view.put("mode", (clips == null || clips.isEmpty()) ? "INFO_ONLY" : "CLIPS_SELECTED");
            view.put("title", d.title() == null ? "" : d.title());
            // 注：`originalTitle` 不再输出 —— 旧路径里它恒为 null（MediaService.get 第 4 个参数就是 null），
            // 写进去也没值；真要展示原名得从 aliases 推，属于另一件事。
            if (d.year() != null) view.put("year", d.year());
            if (d.season() != null) view.put("season", d.season());
            // 封面：**统一优先 Bangumi**（`external_work.cover_url` → 本地缓存 `covers/ext/`），本地封面退成兜底
            // （用户 2026-09-20 拍板；缓存只读，不写 `media.cover_path`）
            String bangumiCover = coverService.ensureExternalCover(d.id(), d.externalCoverUrl());
            String cover = resolveCover(d, bangumiCover, coverMode == null || coverMode.isBlank() ? "embed" : coverMode);
            if (cover != null && !cover.isBlank()) view.put("coverAssetPath", cover);
            // 每部一色：从**实际用到的**封面本地文件算主色（读不到 → 不填，渲染侧退到确定性兜底色）
            // 顺序跟上封面链：本地显式封面优先。**仅银幕式需要**（见上面的 needsAccent）
            if (needsAccent) {
                String accent = coverService.accentColorForPath(
                        d.coverPath() != null && !d.coverPath().isBlank() ? d.coverPath() : bangumiCover);
                if (accent != null) view.put("accentColor", accent);
            }
            view.put("description", d.note() == null ? "" : d.note().trim());
            // 标签已随媒体批量取（以前每部一条 3 表 UNION）
            view.put("tags", d.tagNames());
            // 番剧元数据（Bangumi/AniList 同步结果）：剧情简介 / 类型数组 / 总集数（v0.29 视觉重设计接线）
            // 作品行已在 loadRenderMedia 里按「有简介优先、否则第一条」选好
            ExternalWork work = d.work();
            if (work != null) {
                String synopsis = cleanSynopsis(work.getDescription());
                if (synopsis != null) view.put("synopsis", synopsis);
                List<String> genres = parseGenres(work.getGenresJson());
                if (!genres.isEmpty()) view.put("genres", genres);
            }
            Integer episodeCount = work == null ? null : work.getEpisodeCount();
            if (episodeCount == null && d.episodeRows() > 0) episodeCount = d.episodeRows();
            if (episodeCount != null) view.put("episodeCount", episodeCount);
            if (d.subcategory() != null && !d.subcategory().isBlank()) view.put("subcategory", d.subcategory());
            // 分组名（Remotion 侧据此排章节页与组序）
            String groupName = groupOf(d, groupBy, groupCtx);
            if (groupName != null) view.put("group", groupName);
            // 推荐等级 + 推荐理由（2026-09-26 用户拍板：等级取代 ★ 重点）
            //   tier 名次交给 Remotion：`tier == 0` = 原 ★ 重点（组首核心区 + 结尾全片回顾）
            MediaMark mark = mediaMarks == null ? null : mediaMarks.get(d.id());
            if (mark != null) {
                if (mark.tier() != null) view.put("tier", mark.tier());
                if (mark.reason() != null && !mark.reason().isBlank()) view.put("reason", mark.reason().trim());
            }

            // 片段行：PreparedClip 只带渲染必需字段，tag / 所属集号得回查原始行
            Map<Long, Clip> clipRows = new HashMap<>();
            Map<Long, Episode> episodeRows = new HashMap<>();
            if (clips != null && !clips.isEmpty()) {
                List<Long> clipIds = new ArrayList<>();
                for (RecommendClipSourceService.PreparedClip clip : clips) clipIds.add(clip.id());
                for (Clip row : clipMapper.listByIds(clipIds)) clipRows.put(row.getId(), row);
                for (Episode row : episodeMapper.listByMedia(d.id())) episodeRows.put(row.getId(), row);
            }

            List<Map<String, Object>> clipViews = new ArrayList<>();
            if (clips != null) {
                for (RecommendClipSourceService.PreparedClip clip : clips) {
                    Map<String, Object> cv = new LinkedHashMap<>();
                    cv.put("clipId", clip.id());
                    // 跨媒体借来的片段才带来源标题（设计规格 §5.3）
                    if (clip.sourceMediaId() != null && clip.sourceTitle() != null) cv.put("sourceTitle", clip.sourceTitle());
                    cv.put("title", clip.title() == null || clip.title().isBlank() ? "未命名片段" : clip.title());
                    if (clip.note() != null && !clip.note().isBlank()) cv.put("note", clip.note());
                    Clip row = clipRows.get(clip.id());
                    if (row != null && row.getTag() != null && !row.getTag().isBlank()) cv.put("tag", row.getTag().trim());
                    Episode episode = row == null || row.getEpisodeId() == null ? null : episodeRows.get(row.getEpisodeId());
                    if (episode != null) {
                        if (episode.getEpisodeNo() != null) cv.put("episodeNo", episode.getEpisodeNo());
                        // 集标题常是抓来的网页标题（“...-番剧-全集-高清在线观看-bilibili-哔哩哔哩”），只在短且干净时带上
                        String episodeTitle = cleanEpisodeTitle(episode.getTitle());
                        if (!episodeTitle.isBlank()) cv.put("episodeTitle", episodeTitle);
                    }
                    // 素材尺寸：渲染侧判断"与画幅同比 → 那层模糊背景视频完全看不见"（实测省 ~40% 片段帧耗时）
                    if (clip.assetWidth() > 0 && clip.assetHeight() > 0) {
                        cv.put("assetWidth", clip.assetWidth());
                        cv.put("assetHeight", clip.assetHeight());
                    }
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
        // 素材信息指纹（2026-09-20 用户 A+B）：编辑器靠它判断“库里改过资料”，切回窗口时自动重建会话。
        // 放在根上而不是 params 里——它是元信息，不是渲染参数。
        root.put("metaFingerprint", fingerprintOf(ids, details));

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
        // 结尾（落款）左侧开关（2026-09-20）：**必须一起透传**，否则编辑器里勾了、成片却不生效
        // （预览走本地补丁、导出走后端组装，两边不一致是这类开关最容易踩的坑）。
        show.put("endingWall", detailShow == null || detailShow.get("endingWall") == null || detailShow.get("endingWall"));
        show.put("endingPaging", detailShow != null && Boolean.TRUE.equals(detailShow.get("endingPaging")));
        show.put("endingList", detailShow == null || detailShow.get("endingList") == null || detailShow.get("endingList"));
        show.put("endingIndex", detailShow == null || detailShow.get("endingIndex") == null || detailShow.get("endingIndex"));
        show.put("endingYear", detailShow == null || detailShow.get("endingYear") == null || detailShow.get("endingYear"));
        show.put("endingStats", detailShow != null && Boolean.TRUE.equals(detailShow.get("endingStats")));
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
        // 中景摆位随机种子（编辑器「🎲 重排」写入草稿 → 请求体 → 这里 → Remotion 的 params.seed）。
        // 存种子而不是每帧 Math.random：Remotion 逐帧并行渲染，帧内随机会让同一帧在不同 chunk 里摆不同位置。
        p.put("seed", seed == null ? 0 : seed);
        // 片段原声音量（0 = 全静音；用户 2026-09-20）：静音时 Remotion 侧也不再压 BGM
        p.put("clipVolume", clipVolume == null ? 100 : Math.min(100, Math.max(0, clipVolume)));
        p.put("bgmRange", normalizeBgmRange(bgmRange));
        // 转场音乐（甲：片名卡专用；响的时候在 Remotion 侧把 BGM 压低）
        p.put("stingPath", stingPath == null ? "" : stingPath);
        p.put("stingVolume", stingVolume == null ? 60 : Math.min(100, Math.max(0, stingVolume)));
        p.put("fps", fps);
        p.put("width", width);
        p.put("height", height);
        // 分组/每屏：Remotion 侧已消费（章节页 + 一屏 N 部网格），不再是「透传但不生效」
        p.put("groupBy", groupBy == null ? "" : groupBy);
        // 一级分组内再按推荐等级分群（用户 2026-09-26）；null（老前端 / 未传）= 交给 Remotion 侧默认开
        p.put("tierGroup", tierGroup);
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

    /**
     * BGM 播放范围白名单：`all`（默认，铺满全片）/ `none` / `opening,cards,ending` 的任意子集。
     *
     * 2026-09-20 从单值升级为集合（用户先要「只在开头和结尾」，再要「片名卡也顺带播」）。
     * 归一化：小写、去重、固定顺序（opening → cards → ending）、未知项丢弃；空/脏值 → `all`（不会突然静音）。
     */
    static String normalizeBgmRange(String range) {
        if (range == null) return "all";
        String text = range.trim().toLowerCase();
        if (text.isEmpty() || "all".equals(text)) return "all";
        if ("none".equals(text)) return "none";
        List<String> picked = new ArrayList<>();
        for (String segment : List.of("opening", "cards", "ending")) {
            if (List.of(text.split(",")).stream().map(String::trim).anyMatch(segment::equals)) picked.add(segment);
        }
        return picked.isEmpty() ? "all" : String.join(",", picked);
    }

    /** 集标题长度上限（超过就截断，不再整条丢）。 */
    static final int EPISODE_TITLE_MAX = 24;

    /**
     * 集标题落盘前的清洗：HTML 实体反转义 → 压缩空白 → 截断加省略号。
     *
     * 2026-09-20 前这里是「超过 24 字**整条丢弃**」，本意是过滤抓来的网页标题
     * （`…-番剧-全集-高清在线观看-bilibili-哔哩哔哩`）；实测库里 **136/2087 条**因此完全不显示集标题，
     * 用户报「集标题有时候显示有时候不显示」——排查后发现丢的大多是**多段式真标题**（`①…／②…／③…`），
     * 而带站点尾巴的只有 3 条。现在只截断不丢：尾巴照样被 24 字裁掉，真标题也能看到开头。
     */
    static String cleanEpisodeTitle(String raw) {
        if (raw == null) return "";
        // & 的处理必须放最后（否则 `&amp;quot;` 会被错解成 `"`）
        String text = raw.replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
                .replaceAll("[\\s\\u3000]+", " ")
                .trim();
        return text.length() <= EPISODE_TITLE_MAX ? text : text.substring(0, EPISODE_TITLE_MAX) + "…";
    }

    /** 片段时长（毫秒）：已知起止 → 直接算；开放时长 → 探测已准备素材。 */
    /** 简介清洗：去全角缩进与多余空白，超长截断（渲染侧只排 2–3 行）。 */
    private static String cleanSynopsis(String raw) {
        if (raw == null) return null;
        String text = raw.replace('\u3000', ' ').replaceAll("\\s+", " ").trim();
        if (text.isEmpty()) return null;
        return text.length() > 220 ? text.substring(0, 220).trim() + "…" : text;
    }

    /** `genres_json` → 短标签：Bangumi 的类型数组里混着制作公司/播出季度/关键词，一并保留（渲染侧只取前几个）。 */
    private List<String> parseGenres(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<String> parsed = objectMapper.readValue(json, new TypeReference<List<String>>() { });
            List<String> out = new ArrayList<>();
            for (String value : parsed) {
                if (value == null || value.isBlank()) continue;
                out.add(value.trim());
                if (out.size() >= 6) break;
            }
            return out;
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

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
    private String groupOf(RenderMedia d, String groupBy, GroupContext ctx) {
        if (groupBy == null || groupBy.isBlank() || "none".equals(groupBy)) {
            return null;
        }
        return switch (groupBy) {
            case "year" -> d.year() == null ? "未知年份" : d.year() + " 年";
            case "subcategory" -> {
                // 字典已预加载；取不到就退到快照名
                String sub = d.subcategoryId() == null || d.subcategoryId() <= 0
                        ? d.subcategory() : ctx.subcategoryPaths().getOrDefault(d.subcategoryId(), d.subcategory());
                yield sub == null || sub.isBlank() ? "未分类" : sub;
            }
            case "collection" -> {
                String name = null;
                if (d.collectionIds() != null) {
                    for (Long cid : d.collectionIds()) {
                        String hit = ctx.collectionNames().get(cid);
                        if (hit != null && !hit.isBlank()) {
                            name = hit;
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
    /**
     * 封面解析（推荐视频专用）。
     *
     * 优先级（用户 2026-09-20：「封面统一用 Bangumi」）：
     *   1. **Bangumi 封面缓存**（{@code bangumiCover}，`covers/ext/`；为 null 才往下走）；
     *   2. 本地封面 `media.cover_path`；
     *   3. 预览（url）额外允许片段帧兜底 `/clip-images/...`（embed 读不到：`base64ForCoverPath` 只认 `/covers/`）。
     */
    /**
     * 渲染输入用的媒体视图：只含 `buildRenderInput` **真正消费**的字段
     * （比 `MediaDetail` 轻很多，且不触发任何逐部查询）。
     */
    private record RenderMedia(Long id, String title, Integer year, Integer season, String aliases, String mediaFormat,
                              String status, java.math.BigDecimal rating, String note, String coverPath, String subcategory,
                              Long subcategoryId, String externalCoverUrl, String provider, int episodeRows, long clipCount,
                              String fallbackCoverPath, List<String> tagNames, List<Long> collectionIds, ExternalWork work) {
    }

    /** 分组用的预加载字典（收藏夹名 + 子分类路径），避免 `groupOf` 逐部查库。 */
    private record GroupContext(Map<Long, String> collectionNames, Map<Long, String> subcategoryPaths) {
    }

    /**
     * 批量装载渲染输入所需的媒体。
     *
     * **为什么要它**（2026-09-26）：原先 `for (id : ids) mediaService.get(id)` + 循环里逐部查 tags/
     * external_work/collections/子分类 = **18 条 SQL/部**、185-207ms/部；137 部要 25 秒、557 部超百秒。
     * 现在 **6 条 SQL 封顶**（与 ids 数量无关）。
     */
    private List<RenderMedia> loadRenderMedia(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        Map<Long, MediaMapper.RenderMediaRow> rows = new HashMap<>();
        for (MediaMapper.RenderMediaRow row : mediaMapper.listRenderBatch(ids)) rows.put(row.id(), row);

        // 标签：批量取后按 media_id 分组；每部最多 MAX_TAG_COUNT 个、跳过零引用的（等价于原 buildTags）
        Map<Long, List<String>> tagsByMedia = new HashMap<>();
        for (TagMapper.MediaTagUsage usage : tagMapper.countByMediaIds(ids)) {
            if (usage.refCount() <= 0) continue;
            List<String> list = tagsByMedia.computeIfAbsent(usage.mediaId(), k -> new ArrayList<>());
            if (list.size() < MAX_TAG_COUNT) list.add(usage.name() == null ? "" : usage.name());
        }
        Map<Long, List<Long>> collectionsByMedia = new HashMap<>();
        for (MediaCollectionMapper.MediaCollectionRow row : mediaCollectionMapper.listByMediaIds(ids)) {
            collectionsByMedia.computeIfAbsent(row.mediaId(), k -> new ArrayList<>()).add(row.collectionId());
        }
        Map<Long, List<ExternalWork>> worksByMedia = new HashMap<>();
        for (ExternalWork work : externalWorkMapper.listByMediaIds(ids)) {
            worksByMedia.computeIfAbsent(work.getMediaId(), k -> new ArrayList<>()).add(work);
        }

        List<RenderMedia> out = new ArrayList<>(ids.size());
        for (Long id : ids) {                       // 按传入顺序输出（渲染序号 order 依赖它）
            MediaMapper.RenderMediaRow row = rows.get(id);
            if (row == null) {
                log.warn("Remotion 输入跳过不存在的媒体 {}", id);
                continue;
            }
            List<ExternalWork> works = worksByMedia.getOrDefault(id, List.of());
            ExternalWork work = works.stream()
                    .filter((w) -> w.getDescription() != null && !w.getDescription().isBlank())
                    .findFirst()
                    .orElse(works.isEmpty() ? null : works.get(0));
            out.add(new RenderMedia(row.id(), row.title(), row.year(), row.season(), row.aliases(), row.mediaFormat(),
                    row.status(), row.rating(), row.note(), row.coverPath(), row.subcategory(), row.subcategoryId(),
                    row.externalCoverUrl(), row.provider(), (int) row.episodeRows(), row.clipCount(), row.fallbackCoverPath(),
                    tagsByMedia.getOrDefault(id, List.of()), collectionsByMedia.getOrDefault(id, List.of()), work));
        }
        return out;
    }

    /** 预加载分组字典：收藏夹与子分类都是**小表**，一次取全即可（与媒体数量无关）。 */
    private GroupContext loadGroupContext() {
        Map<Long, String> names = new HashMap<>();
        for (Collection c : collectionMapper.selectList(null)) {
            if (c.getName() != null && !c.getName().isBlank()) names.put(c.getId(), c.getName());
        }
        Map<Long, MediaSubcategory> byId = new HashMap<>();
        for (MediaSubcategory s : mediaSubcategoryMapper.selectList(null)) byId.put(s.getId(), s);
        Map<Long, String> paths = new HashMap<>();
        for (MediaSubcategory s : byId.values()) {
            List<String> chain = new ArrayList<>();
            MediaSubcategory cur = s;
            for (int depth = 0; cur != null && depth < SUB_CATEGORY_DEPTH; depth++) {
                chain.add(0, cur.getName());
                cur = cur.getParentId() == null || cur.getParentId() <= 0 ? null : byId.get(cur.getParentId());
            }
            paths.put(s.getId(), String.join(" / ", chain));
        }
        return new GroupContext(names, paths);
    }

    private String resolveCover(RenderMedia d, String bangumiCover, String coverMode) {
        // 2026-09-25 用户拍板：封面链改为「**本地显式封面 → Bangumi 封面 → 片段帧**」
        // （以前 Bangumi 在前）。自动下载的本地封面已在对账时清掉，所以两级不会打架。
        if ("url".equals(coverMode)) {
            if (d.coverPath() != null && !d.coverPath().isBlank()) return d.coverPath();
            if (bangumiCover != null && !bangumiCover.isBlank()) return bangumiCover;
            return d.fallbackCoverPath();
        }
        String data = coverService.base64ForCoverPath(d.coverPath());
        if (data == null) {
            data = coverService.base64ForCoverPath(bangumiCover);
        }
        if (data == null) {
            data = coverService.base64ForCoverPath(d.fallbackCoverPath());
        }
        return data;
    }

    /** Bangumi 封面预热：并发拉进 `covers/ext/`（已缓存瞬间返回；单张失败不影响其它）。 */
    private void warmExternalCovers(List<RenderMedia> details) {
        List<Callable<Void>> tasks = new ArrayList<>();
        for (RenderMedia detail : details) {
            String url = detail.externalCoverUrl();
            if (url == null || url.isBlank()) continue;
            tasks.add(() -> {
                coverService.ensureExternalCover(detail.id(), url);
                return null;
            });
        }
        if (tasks.isEmpty()) return;
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(6, tasks.size()));
        try {
            pool.invokeAll(tasks);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            pool.shutdown();
        }
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

    /** 推荐模板归一化：chapter/clip 为正式模板；历史 stream/overview 回退到 chapter。 */
    private static String normalizeStyle(String groupStyle) {
        if (groupStyle == null || groupStyle.isBlank()) {
            return "chapter";
        }
        String s = groupStyle.trim().toLowerCase();
        return switch (s) {
            case "chapter", "clip", "cinema" -> s;
            case "stream", "overview" -> "chapter";
            default -> "chapter";
        };
    }

}
