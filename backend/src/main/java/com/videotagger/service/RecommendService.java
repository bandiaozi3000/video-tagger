package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
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

    private final MediaService mediaService;
    private final TagMapper tagMapper;
    private final MediaSubcategoryMapper mediaSubcategoryMapper;
    private final MediaFormatMapper mediaFormatMapper;
    private final CoverService coverService;
    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;

    public RecommendService(MediaService mediaService, TagMapper tagMapper,
                            MediaSubcategoryMapper mediaSubcategoryMapper,
                            MediaFormatMapper mediaFormatMapper, CoverService coverService,
                            ObjectMapper objectMapper, ResourceLoader resourceLoader) {
        this.mediaService = mediaService;
        this.tagMapper = tagMapper;
        this.mediaSubcategoryMapper = mediaSubcategoryMapper;
        this.mediaFormatMapper = mediaFormatMapper;
        this.coverService = coverService;
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

    /**
     * 生成自包含推荐 HTML。
     *
     * @param ids        媒体 id 列表（保持顺序），空 → IllegalArgumentException
     * @param title      推荐页标题文案（主题），空/null → 默认「我的番剧推荐」
     * @param bgmName    背景音乐名称（无 BGM 传 null）
     * @param bgmBase64  背景音乐 base64（纯 base64，无 data: 前缀；无 BGM 传 null）
     */
    public String buildHtml(List<Long> ids, String title, String bgmName, String bgmBase64) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("ids 不能为空");
        }
        String resolved = (title == null || title.isBlank()) ? DEFAULT_TITLE : title.trim();
        String template = readTemplate();
        String slidesJson = buildSlidesJson(ids);
        String bgmSrc = (bgmBase64 == null || bgmBase64.isBlank())
                ? ""
                : "data:" + bgmMime(bgmName) + ";base64," + bgmBase64;
        String bgmLabel = (bgmName == null || bgmName.isBlank()) ? "" : esc(bgmName.trim());
        return template
                .replace("__TITLE__", esc(resolved))
                .replace("__SLIDES_JSON__", slidesJson)
                .replace("__BGM_SRC__", bgmSrc)
                .replace("__BGM_NAME__", bgmLabel);
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

    private String buildSlidesJson(List<Long> ids) {
        List<Map<String, Object>> slides = new ArrayList<>();
        for (Long id : ids) {
            MediaDetail d;
            try {
                d = mediaService.get(id);
            } catch (RuntimeException e) {
                log.warn("推荐跳过不存在的媒体 {}: {}", id, e.getMessage());
                continue; // 残留勾选 → 跳过不报错
            }
            slides.add(slideOf(d));
        }
        try {
            return objectMapper.writeValueAsString(slides);
        } catch (IOException e) {
            throw new IllegalStateException("序列化推荐数据失败", e);
        }
    }

    private Map<String, Object> slideOf(MediaDetail d) {
        Map<String, Object> slide = new LinkedHashMap<>();
        slide.put("cover", resolveCoverDataUrl(d));
        slide.put("cat", buildCategory(d));
        slide.put("title", esc(d.title()));
        slide.put("note", esc(d.note() == null || d.note().isBlank() ? "（暂无备注）" : d.note().trim()));
        slide.put("flag", STATUS_LABEL.getOrDefault(d.status(), d.status() == null ? "" : d.status()));
        slide.put("tags", buildTags(d.id()));
        return slide;
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

    private String readTemplate() {
        try (var in = resourceLoader.getResource("classpath:templates/recommend.html").getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("读取推荐模板失败", e);
        }
    }

    /** HTML 转义：标题/分类/备注/标签名含 <>&" 会破坏模板结构，进 JSON 前先转义。 */
    private static String esc(String s) {
        return s == null ? "" : HtmlUtils.htmlEscape(s);
    }
}
