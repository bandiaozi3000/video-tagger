package com.videotagger.service;

import com.videotagger.entity.Media;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.TagMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.util.TitleParser;
import com.videotagger.util.VideoFingerprint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
public class ClipService {

    private static final Logger log = LoggerFactory.getLogger(ClipService.class);
    private static final long DEDUP_WINDOW_MS = 3_000;
    /** 误触判定：同 URL 3 秒内 且 时间戳相距小于该值（秒）才算同一片段 */
    private static final double DEDUP_TIME_TOLERANCE_SEC = 3.0;

    private final ClipMapper clipMapper;
    private final MediaMapper mediaMapper;
    private final MediaFormatMapper mediaFormatMapper;
    private final MediaSubcategoryMapper mediaSubcategoryMapper;
    private final EpisodeMapper episodeMapper;
    private final TagMapper tagMapper;
    private final ClipTagMapper clipTagMapper;
    private final CoverService coverService;
    private final EmbeddingTaskService embeddingTaskService;
    private final TagSyncService tagSyncService;

    public ClipService(ClipMapper clipMapper, MediaMapper mediaMapper,
                       MediaFormatMapper mediaFormatMapper, MediaSubcategoryMapper mediaSubcategoryMapper,
                       EpisodeMapper episodeMapper, TagMapper tagMapper, ClipTagMapper clipTagMapper,
                       CoverService coverService, EmbeddingTaskService embeddingTaskService,
                       TagSyncService tagSyncService) {
        this.clipMapper = clipMapper;
        this.mediaMapper = mediaMapper;
        this.mediaFormatMapper = mediaFormatMapper;
        this.mediaSubcategoryMapper = mediaSubcategoryMapper;
        this.episodeMapper = episodeMapper;
        this.tagMapper = tagMapper;
        this.clipTagMapper = clipTagMapper;
        this.coverService = coverService;
        this.embeddingTaskService = embeddingTaskService;
        this.tagSyncService = tagSyncService;
    }

    @Transactional
    public SaveClipResult save(SaveClipRequest req) {
        long now = System.currentTimeMillis();

        // 仅当同 URL、3 秒内、时间戳接近、且标签相同时才视为误触连按（去重）。
        // 同片段补不同标签属于「追加标注」，走新建记录，避免静默吞数据。
        Clip recent = clipMapper.findRecentNearTime(req.url(), now - DEDUP_WINDOW_MS,
                req.timestampSec(), DEDUP_TIME_TOLERANCE_SEC);
        if (recent != null && recent.getTag().equals(req.tag())) {
            return new SaveClipResult(recent.getId(), true);
        }

        // 媒体归属：标题前缀 + 正则解析 + URL 域名粗判格式，纯本地快路径（打标主链路不碰 LLM）
        TitleParser.ParsedTitle parsed = TitleParser.parse(req.title());
        Media media = ensureMedia(parsed, detectFormat(req.url()), now);
        Episode episode = ensureEpisode(parsed, req, media.getId(), now);

        Clip clip = new Clip();
        clip.setTitle(req.title());
        clip.setUrl(req.url());
        clip.setVideoFp(VideoFingerprint.fingerprint(req.url()));
        clip.setEpisodeId(episode.getId());
        clip.setTimestampSec(req.timestampSec());
        clip.setVideoDuration(req.videoDuration());
        clip.setTag(req.tag());
        clip.setNote(req.note() == null ? "" : req.note());
        clip.setCreatedAt(now);
        clipMapper.insert(clip);

        linkClipTags(clip.getId(), req.tag(), now);

        // 片段截帧封面：base64 内嵌保存，解码/落盘失败降级无封面（不反噬保存事务）
        if (req.coverDataUrl() != null && !req.coverDataUrl().isBlank()) {
            try {
                byte[] cover = coverService.decodeDataUrl(req.coverDataUrl());
                String path = coverService.saveClipCover(clip.getId(), cover);
                clip.setCoverPath(path);
                clipMapper.updateById(clip);
            } catch (Exception e) {
                log.warn("片段 {} 封面落盘失败（降级无封面）：{}", clip.getId(), e.getMessage());
            }
        }

        // 片段详情大图：与缩略图同理，失败降级仅无大图（悬浮回退缩略图）
        if (req.detailCoverDataUrl() != null && !req.detailCoverDataUrl().isBlank()) {
            try {
                byte[] detail = coverService.decodeDataUrl(req.detailCoverDataUrl());
                String path = coverService.saveClipDetailCover(clip.getId(), detail);
                clip.setDetailCoverPath(path);
                clipMapper.updateById(clip);
            } catch (Exception e) {
                log.warn("片段 {} 详情大图落盘失败（降级仅缩略图）：{}", clip.getId(), e.getMessage());
            }
        }

        // 扩展携带 og:image 时异步下载番剧封面（失败降级无封面，不阻塞保存）
        if (req.ogImage() != null && !req.ogImage().isBlank()) {
            coverService.downloadAsync(media.getId(), req.ogImage());
        }

        embeddingTaskService.enqueue(EntityType.CLIP, clip.getId());

        return new SaveClipResult(clip.getId(), false, media.getId(), media.getTitle(), episode.getEpisodeNo());
    }

    /**
     * 编辑标签。tag/note 变化时删除旧向量并重置 embedding 任务（异步重生成）。
     * appendTag=true 时把新 tag 并入原 tag（按空白分词去重）。
     */
    @Transactional
    public Clip update(Long id, SaveClipRequest req, boolean appendTag) {
        Clip clip = clipMapper.selectById(id);
        if (clip == null) {
            throw new NoSuchElementException("clip not found: " + id);
        }
        String oldTag = clip.getTag();
        String oldNote = clip.getNote() == null ? "" : clip.getNote();

        clip.setTitle(req.title());
        clip.setUrl(req.url());
        clip.setVideoFp(VideoFingerprint.fingerprint(req.url()));
        clip.setTimestampSec(req.timestampSec());
        // 编辑请求未携带时长时保留原值
        clip.setVideoDuration(req.videoDuration() != null ? req.videoDuration() : clip.getVideoDuration());
        clip.setTag(appendTag ? appendTag(oldTag, req.tag()) : req.tag());
        clip.setNote(req.note() == null ? "" : req.note());
        clipMapper.updateById(clip);

        if (!oldTag.equals(clip.getTag()) || !oldNote.equals(clip.getNote())) {
            clipTagMapper.deleteByClip(id);
            linkClipTags(id, clip.getTag(), System.currentTimeMillis());
            embeddingTaskService.enqueue(EntityType.CLIP, id);
        }
        return clip;
    }

    /** 删除标签：同时清理向量任务、标签关联与截帧封面文件。 */
    @Transactional
    public boolean delete(Long id) {
        Clip clip = clipMapper.selectById(id);
        if (clip == null) {
            return false;
        }
        coverService.deleteCover(clip.getCoverPath());
        coverService.deleteCover(clip.getDetailCoverPath());
        embeddingTaskService.deleteFor(EntityType.CLIP, id);
        clipTagMapper.deleteByClip(id);
        return clipMapper.deleteById(id) > 0;
    }

    /** 片段详情页：按 id 取完整片段，不存在抛 404。 */
    public Clip get(Long id) {
        Clip clip = clipMapper.selectById(id);
        if (clip == null) {
            throw new NoSuchElementException("clip not found: " + id);
        }
        return clip;
    }

    /**
     * 标签补全建议：从词库按三级引用聚合计数（媒体/集/片段全覆盖）。
     * mediaId != null 时该媒体已用标签优先（媒体上下文），再补全局高频兜底。
     * 排序：精确命中 > 前缀 > 包含；同级次数降序、名称升序。用于扩展浮层/Web 打标输入补全。
     */
    public List<TagSuggestion> suggestTags(String prefix, int limit, Long mediaId) {
        String p = prefix == null ? "" : prefix.trim().toLowerCase();
        List<TagSuggestion> out = new ArrayList<>();
        Set<String> mediaSourced = new HashSet<>();
        if (mediaId != null) {
            for (TagUsage u : tagMapper.countByMedia(mediaId)) {
                if (matchPrefix(u.name(), p)) {
                    out.add(new TagSuggestion(u.name(), u.total()));
                    mediaSourced.add(u.name());
                }
            }
        }
        for (TagUsage u : tagMapper.countGlobal()) {
            if (!mediaSourced.contains(u.name()) && matchPrefix(u.name(), p)) {
                out.add(new TagSuggestion(u.name(), u.total()));
            }
        }
        return out.stream()
                .sorted(Comparator
                        .comparingInt((TagSuggestion s) -> mediaSourced.contains(s.tag()) ? 1 : 0)
                        .reversed()
                        .thenComparing(Comparator.comparingInt(
                                (TagSuggestion s) -> prefixRank(s.tag(), p)).reversed())
                        .thenComparing(TagSuggestion::count, Comparator.reverseOrder())
                        .thenComparing(TagSuggestion::tag))
                .limit(limit)
                .toList();
    }

    private static boolean matchPrefix(String name, String p) {
        return p.isEmpty() || name.toLowerCase().contains(p);
    }

    /** 补全排序权重：精确命中 3 > 前缀 2 > 包含 1。 */
    private static int prefixRank(String name, String p) {
        if (p.isEmpty()) {
            return 0;
        }
        String n = name.toLowerCase();
        if (n.equals(p)) {
            return 3;
        }
        if (n.startsWith(p)) {
            return 2;
        }
        return 1;
    }

    /** 查询同一视频中时间戳邻近（±window 秒）的既有标记，供扩展做重复片段提示。 */
    public List<Clip> findNearby(String url, double timestampSec, double window) {
        return clipMapper.findNearby(url, timestampSec, window);
    }

    /** 把新标签并入原标签：按空白分词、去重、空格连接；已存在则原样返回。 */
    static String appendTag(String existing, String added) {
        String trimmed = added == null ? "" : added.trim();
        if (trimmed.isEmpty()) {
            return existing;
        }
        Set<String> tokens = new LinkedHashSet<>();
        for (String t : existing.split("\\s+")) {
            if (!t.isEmpty()) {
                tokens.add(t);
            }
        }
        if (tokens.add(trimmed)) {
            return String.join(" ", tokens);
        }
        return existing;
    }

    // ---------- 番剧三层归属 ----------

    /** 按解析出的媒体名归组：前缀命中既有媒体则复用，否则新建（confirmed=0 待确认）。 */
    private Media ensureMedia(TitleParser.ParsedTitle parsed, String format, long now) {
        String name = parsed.mediaTitle();
        Media media = name.length() >= 2 ? mediaMapper.selectByTitlePrefix(name) : null;
        if (media == null) {
            media = new Media();
            media.setTitle(name);
            media.setMediaFormat(format);
            // 扩展打标默认视频/番剧；探测到其他子分类时用探测值；格式树下找不到节点保持未分类
            String sub = parsed.subcategory() != null && !parsed.subcategory().isEmpty()
                    ? parsed.subcategory() : "番剧";
            applyDetectedSubcategory(media, format, sub);
            media.setStatus("WANT");
            media.setConfirmed(0);
            media.setCreatedAt(now);
            mediaMapper.insert(media);
        }
        return media;
    }

    /** 按探测到的子分类名在格式树下找节点，写 id + 名字快照；找不到保持未分类。 */
    private void applyDetectedSubcategory(Media media, String format, String sub) {
        MediaFormat mf = mediaFormatMapper.selectOne(new QueryWrapper<MediaFormat>().eq("code", format));
        if (mf == null) {
            return;
        }
        MediaSubcategory node = mediaSubcategoryMapper.selectOne(
                new QueryWrapper<MediaSubcategory>().eq("format_id", mf.getId()).eq("name", sub)
                        .last("LIMIT 1"));
        if (node != null) {
            media.setSubcategoryId(node.getId());
            media.setSubcategory(node.getName());
        }
    }

    /** URL 域名 → 媒体格式粗判：图片站→IMAGE，其余默认 VIDEO（扩展主要跑视频站）。 */
    private static String detectFormat(String url) {
        String u = url == null ? "" : url.toLowerCase();
        if (u.contains("pixiv.net") || u.contains("artstation.com") || u.contains("danbooru")
                || u.contains("safebooru") || u.contains("pinterest.com") || u.contains("unsplash.com")) {
            return "IMAGE";
        }
        return "VIDEO";
    }

    /** 按 URL 指纹定位集：同一 video_fp 复用，否则创建并挂到番剧下。 */
    private Episode ensureEpisode(TitleParser.ParsedTitle parsed, SaveClipRequest req, long mediaId, long now) {
        String fp = VideoFingerprint.fingerprint(req.url());
        Episode ep = episodeMapper.selectByFp(fp);
        if (ep == null) {
            ep = new Episode();
            ep.setMediaId(mediaId);
            ep.setSeason(parsed.season());   // 解析不到保持 null，前端「未识别」分组高亮提示编辑
            ep.setEpisodeNo(parsed.episodeNo());
            ep.setTitle(req.title());
            ep.setUrl(req.url());
            ep.setVideoFp(fp);
            ep.setCreatedAt(now);
            episodeMapper.insert(ep);
        }
        return ep;
    }

    /** 片段标签写入词库关联：无则建 tag 词条，有则复用；随后向上并集同步到所属集与媒体。 */
    private void linkClipTags(long clipId, String tagText, long now) {
        for (String token : tagText.trim().split("\\s+")) {
            if (token.isEmpty()) {
                continue;
            }
            tagMapper.insertIgnore(token, now);
            Tag tag = tagMapper.selectByName(token);
            if (tag != null) {
                clipTagMapper.insertIgnore(clipId, tag.getId());
            }
        }
        tagSyncService.syncFromClip(clipId);
    }
}
