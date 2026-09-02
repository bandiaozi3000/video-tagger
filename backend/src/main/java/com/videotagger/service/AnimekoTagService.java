package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.Media;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.TagMapper;
import com.videotagger.util.AnimekoPaths;
import com.videotagger.util.VideoFingerprint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;

/**
 * v0.24 M2 现场热键打标：Animeko 暂停即把 playhead 落盘（源码已证实），
 * 此服务读取「最近一条 active 播放记录」作为现场上下文 → 经 Bangumi id 桥映射本地 Episode
 * → 建 Clip（复用 M1 的映射与 M3 的渠道求值回写渠道线索），文件在场可由前端当场剪。
 */
@Service
public class AnimekoTagService {

    private static final Logger log = LoggerFactory.getLogger(AnimekoTagService.class);
    private static final String PROVIDER_BANGUMI = "BANGUMI";

    private final EpisodeMapper episodeMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final ExternalEpisodeMapper externalEpisodeMapper;
    private final MediaMapper mediaMapper;
    private final ClipMapper clipMapper;
    private final TagMapper tagMapper;
    private final ClipTagMapper clipTagMapper;
    private final TagSyncService tagSyncService;
    private final EmbeddingTaskService embeddingTaskService;
    private final MaterializationService materializationService;
    private final String dbPath;
    /** 可选：片段封面抽帧（无封面能力时保持原行为）。 */
    private final ClipFrameGrabber frameGrabber;

    public AnimekoTagService(EpisodeMapper episodeMapper,
                             ExternalWorkMapper externalWorkMapper,
                             ExternalEpisodeMapper externalEpisodeMapper,
                             MediaMapper mediaMapper,
                             ClipMapper clipMapper,
                             TagMapper tagMapper,
                             ClipTagMapper clipTagMapper,
                             TagSyncService tagSyncService,
                             EmbeddingTaskService embeddingTaskService,
                             MaterializationService materializationService,
                             @Value("${videotagger.animeko.db-path:}") String dbPath,
                             @Autowired(required = false) ClipFrameGrabber frameGrabber) {
        this.episodeMapper = episodeMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.externalEpisodeMapper = externalEpisodeMapper;
        this.mediaMapper = mediaMapper;
        this.clipMapper = clipMapper;
        this.tagMapper = tagMapper;
        this.clipTagMapper = clipTagMapper;
        this.tagSyncService = tagSyncService;
        this.embeddingTaskService = embeddingTaskService;
        this.materializationService = materializationService;
        this.frameGrabber = frameGrabber;
        this.dbPath = AnimekoPaths.resolve(dbPath);
    }

    // ---------- 现场播放头 ----------

    /** Animeko 最近一条有效播放记录（=正在看/刚暂停的集）。 */
    public record Playhead(Integer subjectId, int episodeId, long positionMillis, long durationMillis,
                           long updatedAtMillis, String subjectName, String episodeName) {
    }

    public record PlayheadView(boolean configured, boolean reachable, String message,
                               Long bangumiSubjectId, Long bangumiEpisodeId, Long positionMs, Long durationMs,
                               Long updatedAtMillis, String subjectName, String episodeName,
                               boolean mapped, Long localEpisodeId, Long mediaId,
                               String mediaTitle, String episodeLabel, String episodeTitle) {
    }

    public PlayheadView playhead() {
        if (dbPath.isEmpty()) {
            return new PlayheadView(false, false, "未配置 Animeko 数据库路径", null, null, null, null, null, null, null, false, null, null, null, null, null);
        }
        File file = new File(dbPath);
        if (!file.isFile()) {
            return new PlayheadView(true, false, "Animeko 数据库不存在: " + file.getAbsolutePath(), null, null, null, null, null, null, null, false, null, null, null, null, null);
        }
        Playhead p;
        try (Connection conn = open()) {
            p = readLatest(conn);
        } catch (Exception e) {
            log.warn("[animeko] 读播放头失败: {}", e.getMessage());
            return new PlayheadView(true, false, "读取失败: " + e.getMessage(), null, null, null, null, null, null, null, false, null, null, null, null, null);
        }
        if (p == null) {
            return new PlayheadView(true, true, "Animeko 暂无播放记录（先播一集并暂停）", null, null, null, null, null, null, null, false, null, null, null, null, null);
        }
        return new PlayheadView(true, true, "ok", p.subjectId() == null ? null : p.subjectId().longValue(),
                (long) p.episodeId(), p.positionMillis(), p.durationMillis(), p.updatedAtMillis(),
                p.subjectName(), p.episodeName(),
                false, null, null, null, null, null);
    }

    /** 播放头 + 本地映射（media/episode 信息，供浮层展示与建档引导）。 */
    public PlayheadView mappedPlayhead() {
        PlayheadView view = playhead();
        if (!view.reachable() || view.bangumiSubjectId() == null || view.bangumiEpisodeId() == null) {
            return view;
        }
        MappedLocal mapped = mapToLocal(view.bangumiSubjectId(), view.bangumiEpisodeId());
        if (mapped == null) {
            return view; // mapped=false 保留，message 提示建档
        }
        return new PlayheadView(view.configured(), view.reachable(), "ok",
                view.bangumiSubjectId(), view.bangumiEpisodeId(), view.positionMs(), view.durationMs(),
                view.updatedAtMillis(), view.subjectName(), view.episodeName(),
                true, mapped.episode().getId(), mapped.media() == null ? null : mapped.media().getId(),
                mapped.media() == null ? null : mapped.media().getTitle(),
                label(mapped.episode()), mapped.episode().getTitle());
    }

    // ---------- 打标 ----------

    public record TagRequest(String tag, String note, Long startMs, Long endMs) {
    }

    /** 打标结果：建出的 Clip + 渠道求值结论（供「当场剪」引导）。 */
    public record TagResult(boolean ok, String message, String code,
                            Long clipId, Long localEpisodeId, Long mediaId,
                            String channel, String state, String channelMessage) {
    }

    /** 现场打标：读播放头 → 映射 → 建 Clip（带渠道线索回写）。 */
    public TagResult tag(TagRequest req) {
        PlayheadView view = mappedPlayhead();
        if (!view.configured()) return new TagResult(false, "未配置 Animeko 数据库路径", "UNCONFIGURED", null, null, null, null, null, null);
        if (!view.reachable()) return new TagResult(false, view.message(), "UNREACHABLE", null, null, null, null, null, null);
        if (view.bangumiEpisodeId() == null) return new TagResult(false, view.message(), "NO_PLAYBACK", null, null, null, null, null, null);
        if (req == null || req.tag() == null || req.tag().isBlank()) {
            return new TagResult(false, "标签必填", "BAD_REQUEST", null, null, null, null, null, null);
        }
        if (!view.mapped()) {
            return new TagResult(false, "本地未建档：Bangumi subject " + view.bangumiSubjectId()
                    + " 尚未同步到本库（请先到媒体详情用「同步资料」建档），或该集未绑定本地集", "NEED_ARCHIVE",
                    null, null, null, null, null, null);
        }
        long now = System.currentTimeMillis();
        Clip clip = new Clip();
        clip.setTitle(effectiveClipTitle(view));
        // Animeko 现场打标无网页 URL：用稳定引用占位（fingerprint 亦稳定），真实文件经 C1/C2 渠道定位
        String refUrl = "animeko://bangumi/" + view.bangumiSubjectId() + "/ep/" + view.bangumiEpisodeId();
        clip.setUrl(refUrl);
        clip.setVideoFp(VideoFingerprint.fingerprint(refUrl));
        clip.setEpisodeId(view.localEpisodeId());
        clip.setTimestampSec(((req.startMs() != null ? req.startMs() : view.positionMs())) / 1000d);
        clip.setEndSec(req.endMs() == null ? null : req.endMs() / 1000d);
        clip.setStartMs(req.startMs() != null ? req.startMs() : view.positionMs());
        clip.setEndMs(req.endMs());
        clip.setVideoAssetId(null);
        clip.setMaterialState("REFERENCE_ONLY");
        clip.setTag(req.tag().trim());
        clip.setNote(req.note() == null ? "" : req.note());
        clip.setCreatedAt(now);
        clipMapper.insert(clip);

        // 标签关联（与 ClipService.save 同链路）
        for (String token : req.tag().trim().split("\\s+")) {
            if (token.isEmpty()) continue;
            tagMapper.insertIgnore(token, now);
            com.videotagger.entity.Tag tag = tagMapper.selectByName(token);
            if (tag != null) clipTagMapper.insertIgnore(clip.getId(), tag.getId());
        }
        tagSyncService.syncFromClip(clip.getId());
        embeddingTaskService.enqueue(EntityType.CLIP, clip.getId());

        // 幂等标记已看（Animeko 播放事实已带回）
        if (view.updatedAtMillis() != null) {
            Episode patch = new Episode();
            patch.setId(view.localEpisodeId());
            patch.setWatchedAt(view.updatedAtMillis());
            episodeMapper.updateById(patch);
        }

        // 渠道求值并回写 channel_hints（C1/C2 探测当场文件）
        MaterializationService.Evaluation ev;
        try {
            ev = materializationService.evaluate(clip.getId(), true);
        } catch (Exception e) {
            log.warn("[animeko] 打标后渠道求值失败 clip={}: {}", clip.getId(), e.getMessage());
            ev = null;
        }
        String channel = ev == null ? null : ev.channel();
        String state = ev == null ? null : ev.state();
        String channelMsg = ev == null ? null : ev.message();
        // 渠道文件在场（C1/C2）→ 异步抽帧生成片段封面（当前画面=暂停位置帧）
        if (frameGrabber != null && ev != null && "PRESENT".equals(ev.state()) && ev.filePath() != null) {
            // 抽帧时刻：优先用户标定起点；无起点时用暂停位置。clamp 到集时长内（防 -ss 超界空输出）
            long shotMs = clip.getStartMs() != null ? clip.getStartMs()
                    : (view.positionMs() != null ? view.positionMs() : 0L);
            long durMs = view.durationMs() != null ? view.durationMs() : Long.MAX_VALUE;
            shotMs = Math.max(0, Math.min(shotMs, durMs - 500));
            frameGrabber.grabFrameAsync(clip.getId(), ev.filePath(), shotMs);
        }
        return new TagResult(true, "已打标片段 #" + clip.getId(), "OK", clip.getId(),
                view.localEpisodeId(), view.mediaId(), channel, state, channelMsg);
    }

    // ---------- 内部 ----------

    private Connection open() throws Exception {
        Class.forName("org.sqlite.JDBC");
        return DriverManager.getConnection("jdbc:sqlite:" + new File(dbPath).getAbsolutePath());
    }

    private Playhead readLatest(Connection conn) throws Exception {
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT episodeId, subjectId, positionMillis, durationMillis, "
                     + "updatedAtMillis, subjectName, episodeName "
                     + "FROM playback_history_record "
                     + "WHERE deletedAtMillis IS NULL "
                     + "ORDER BY updatedAtMillis DESC LIMIT 1")) {
            if (!rs.next()) return null;
            return new Playhead(
                    rs.getObject("subjectId") == null ? null : rs.getInt("subjectId"),
                    rs.getInt("episodeId"),
                    rs.getLong("positionMillis"), rs.getLong("durationMillis"),
                    rs.getLong("updatedAtMillis"),
                    rs.getString("subjectName"), rs.getString("episodeName"));
        }
    }

    /** BANGUMI 桥映射到本地集；找不到返回 null（前端展示建档引导）。 */
    private MappedLocal mapToLocal(long subjectId, long bangumiEpisodeId) {
        ExternalWork work = externalWorkMapper.selectByProviderAndExternalId(PROVIDER_BANGUMI, String.valueOf(subjectId));
        if (work == null) return null;
        ExternalEpisode external = externalEpisodeMapper.selectByProviderEpisode(work.getId(), String.valueOf(bangumiEpisodeId));
        if (external == null || external.getEpisodeId() == null) return null;
        Episode ep = episodeMapper.selectById(external.getEpisodeId());
        if (ep == null) return null;
        Media media = ep.getMediaId() == null ? null : mediaMapper.selectById(ep.getMediaId());
        return new MappedLocal(ep, media);
    }

    private record MappedLocal(Episode episode, Media media) {
    }

    private String label(Episode ep) {
        if (ep.getSeason() != null && ep.getEpisodeNo() != null) return "S" + ep.getSeason() + "-Ep" + ep.getEpisodeNo();
        if (ep.getEpisodeNo() != null) return "第" + ep.getEpisodeNo() + "集";
        return "本集";
    }

    private String effectiveClipTitle(PlayheadView view) {
        if (view.episodeTitle() != null && !view.episodeTitle().isBlank()) return view.episodeTitle();
        if (view.episodeName() != null && !view.episodeName().isBlank()) return view.episodeName();
        String base = view.mediaTitle() != null ? view.mediaTitle() : (view.subjectName() != null ? view.subjectName() : "Animeko 片段");
        return view.episodeLabel() != null ? base + " · " + view.episodeLabel() : base;
    }
}
