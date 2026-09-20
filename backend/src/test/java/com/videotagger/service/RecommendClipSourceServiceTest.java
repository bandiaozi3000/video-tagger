package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 片段素材**混合策略**单测（设计规格 §8.1）。
 *
 * 覆盖三条分支的选择逻辑（不依赖真实 ffmpeg）：
 * 1. 物化产物 h264+aac → 直接复制（零重编码）；
 * 2. 物化产物 HEVC → 不走复制，改走重编码（此处 ffmpeg 不存在 → 记为 missing）；
 * 3. 无产物且无本地源视频 → missing 且原因可读。
 */
class RecommendClipSourceServiceTest {

    @TempDir
    Path assetRoot;

    @TempDir
    Path workDir;

    private static final long MEDIA_ID = 42L;
    private static final long CLIP_ID = 7L;

    private Clip clip() {
        Clip clip = new Clip();
        clip.setId(CLIP_ID);
        clip.setTitle("测试片段");
        clip.setTimestampSec(10d);
        clip.setEndSec(20d);
        clip.setStartMs(10_000L);
        clip.setEndMs(20_000L);
        clip.setVideoFp("abc123");
        clip.setVideoAssetId(99L);
        return clip;
    }

    private RecommendClipSourceService service(ClipMapper clipMapper, VideoAssetMapper assetMapper,
                                               LocalVideoResolver resolver, MediaProbe probe) {
        return service(clipMapper, assetMapper, resolver, probe, null, null);
    }

    /** 可注入「同系列解析」与媒体标题查询（跨媒体借片段的校验/角标用）。 */
    private RecommendClipSourceService service(ClipMapper clipMapper, VideoAssetMapper assetMapper,
                                               LocalVideoResolver resolver, MediaProbe probe,
                                               RelatedMediaService related, com.videotagger.mapper.MediaMapper mediaMapper) {
        return service(clipMapper, assetMapper, resolver, probe, related, mediaMapper, null);
    }

    /** 再加一个 EpisodeMapper（悬空引用修复建议用）。 */
    private RecommendClipSourceService service(ClipMapper clipMapper, VideoAssetMapper assetMapper,
                                               LocalVideoResolver resolver, MediaProbe probe,
                                               RelatedMediaService related, com.videotagger.mapper.MediaMapper mediaMapper,
                                               com.videotagger.mapper.EpisodeMapper episodeMapper) {
        ClipExportProperties properties = new ClipExportProperties();
        properties.setFfmpegPath("no-such-ffmpeg-binary");
        properties.setTaskTimeoutSec(5);
        return new RecommendClipSourceService(clipMapper, resolver, properties, assetMapper, probe,
                assetRoot.toString(), 30, related, mediaMapper, episodeMapper);
    }

    private Map<Long, RecommendMediaClips> request() {
        return Map.of(MEDIA_ID, new RecommendMediaClips(List.of(CLIP_ID), null));
    }

    @Test
    void reusesH264ArtifactWithoutTranscoding() throws Exception {
        Path artifact = assetRoot.resolve("media-0/entry-0/episode-1/asset-99.mp4");
        Files.createDirectories(artifact.getParent());
        byte[] payload = new byte[2048];
        java.util.Arrays.fill(payload, (byte) 1);
        Files.write(artifact, payload);

        VideoAsset asset = new VideoAsset();
        asset.setId(99L);
        asset.setAvailabilityState("AVAILABLE");
        asset.setStoragePath("media-0/entry-0/episode-1/asset-99.mp4");
        asset.setDurationMs(10_000L);
        asset.setVideoCodec("h264");
        asset.setAudioCodec("aac");

        ClipMapper clipMapper = mock(ClipMapper.class);
        VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
        when(clipMapper.listByMedia(MEDIA_ID)).thenReturn(List.of(clip()));
        when(assetMapper.selectById(99L)).thenReturn(asset);

        RecommendClipSourceService.PreparedClips result =
                service(clipMapper, assetMapper, mock(LocalVideoResolver.class), mock(MediaProbe.class))
                        .prepare(request(), workDir);

        assertTrue(result.missing().isEmpty(), "h264 产物应零重编码直用，不应产生 missing");
        Path output = workDir.resolve("media/clip-" + CLIP_ID + ".mp4");
        assertTrue(Files.isRegularFile(output), "产物应已复制进会话目录");
        assertEquals(2048L, Files.size(output), "复制路径：内容与产物一致（未经过 ffmpeg 重编码）");
    }

    @Test
    void transcodesWhenArtifactCodecNotWebPlayable() throws Exception {
        Path artifact = assetRoot.resolve("asset-hevc.mp4");
        Files.write(artifact, new byte[2048]);

        VideoAsset asset = new VideoAsset();
        asset.setId(99L);
        asset.setAvailabilityState("AVAILABLE");
        asset.setStoragePath("asset-hevc.mp4");
        asset.setDurationMs(10_000L);
        asset.setVideoCodec("hevc");
        asset.setAudioCodec("aac");

        ClipMapper clipMapper = mock(ClipMapper.class);
        VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
        when(clipMapper.listByMedia(MEDIA_ID)).thenReturn(List.of(clip()));
        when(assetMapper.selectById(99L)).thenReturn(asset);

        RecommendClipSourceService.PreparedClips result =
                service(clipMapper, assetMapper, mock(LocalVideoResolver.class), mock(MediaProbe.class))
                        .prepare(request(), workDir);

        // 走了重编码分支（ffmpeg 不存在 → 失败并记录原因），而不是把 HEVC 产物直接复制给浏览器
        assertEquals(1, result.missing().size());
        assertTrue(result.missing().get(0).reason().toLowerCase().contains("ffmpeg")
                        || result.missing().get(0).reason().contains("片段"),
                "重编码分支应给出可读原因: " + result.missing().get(0).reason());
        assertTrue(Files.notExists(workDir.resolve("media/clip-" + CLIP_ID + ".mp4")));
    }

    @Test
    void missingWhenNeitherArtifactNorLocalSource() {
        ClipMapper clipMapper = mock(ClipMapper.class);
        when(clipMapper.listByMedia(MEDIA_ID)).thenReturn(List.of(clip()));
        LocalVideoResolver resolver = mock(LocalVideoResolver.class);
        when(resolver.resolve("abc123")).thenThrow(new IllegalArgumentException("找不到本地源视频"));

        RecommendClipSourceService.PreparedClips result =
                service(clipMapper, mock(VideoAssetMapper.class), resolver, mock(MediaProbe.class))
                        .prepare(request(), workDir);

        assertEquals(1, result.missing().size());
        assertTrue(result.missing().get(0).reason().contains("找不到本地源视频"));
    }
@Test
    void transcodesWhenArtifactFpsDiffersFromTimeline() throws Exception {
        // 2026-09-19 回归：帧率与时间轴不一致的产物**不能**直通。
        // 以前只看编解码，23.976fps 的产物被零重编码复制进 30fps 时间轴 →
        // 逐帧按时间取源帧时出现规律性重复/跳帧（观感「片段一直在晃」）。
        Path artifact = assetRoot.resolve("asset-23.mp4");
        Files.write(artifact, new byte[2048]);

        VideoAsset asset = new VideoAsset();
        asset.setId(99L);
        asset.setAvailabilityState("AVAILABLE");
        asset.setStoragePath("asset-23.mp4");
        asset.setDurationMs(10_000L);
        asset.setVideoCodec("h264");
        asset.setAudioCodec("aac");

        ClipMapper clipMapper = mock(ClipMapper.class);
        VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
        when(clipMapper.listByMedia(MEDIA_ID)).thenReturn(List.of(clip()));
        when(assetMapper.selectById(99L)).thenReturn(asset);

        MediaProbe probe = mock(MediaProbe.class);
        when(probe.fps(anyString())).thenReturn(23.976);
        when(probe.codecs(anyString())).thenReturn(new MediaProbe.Codecs("h264", "aac", true));

        RecommendClipSourceService.PreparedClips result =
                service(clipMapper, assetMapper, mock(LocalVideoResolver.class), probe)
                        .prepare(request(), workDir);

        // 走了重编码分支（测试环境无 ffmpeg → 记为 missing），而不是把 23.976 的产物直接复制
        assertEquals(1, result.missing().size(), "帧率不一致应改走重编码，不应直通");
        Path output = workDir.resolve("media/clip-" + CLIP_ID + ".mp4");
        assertTrue(!Files.exists(output) || Files.size(output) != 2048L, "不应留下与产物字节相同的直通文件");
    }

    @Test
    void reuses23976ArtifactOnCinema24Timeline() throws Exception {
        // 2026-09-20（用户拍板）：银幕式时间轴改 24fps —— 23.976fps 素材与 24 差 0.024（容差 0.05），
        // 应**直通不重编码**：这才是消除“每 5 帧补一帧”顿挫的正解，还省时间、不掉画质。
        Path artifact = assetRoot.resolve("asset-23976.mp4");
        Files.write(artifact, new byte[2048]);

        VideoAsset asset = new VideoAsset();
        asset.setId(99L);
        asset.setAvailabilityState("AVAILABLE");
        asset.setStoragePath("asset-23976.mp4");
        asset.setDurationMs(10_000L);
        asset.setVideoCodec("h264");
        asset.setAudioCodec("aac");

        ClipMapper clipMapper = mock(ClipMapper.class);
        VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
        when(clipMapper.listByMedia(MEDIA_ID)).thenReturn(List.of(clip()));
        when(assetMapper.selectById(99L)).thenReturn(asset);

        MediaProbe probe = mock(MediaProbe.class);
        when(probe.fps(anyString())).thenReturn(23.976);
        when(probe.codecs(anyString())).thenReturn(new MediaProbe.Codecs("h264", "aac", true));

        RecommendClipSourceService.PreparedClips result =
                service(clipMapper, assetMapper, mock(LocalVideoResolver.class), probe)
                        .prepare(request(), workDir, 24);

        assertTrue(result.missing().isEmpty(), "24fps 时间轴下 23.976 素材应直通，不该判为缺素材");
        Path output = workDir.resolve("media/clip-" + CLIP_ID + ".mp4");
        assertEquals(2048L, Files.size(output), "应是零重编码直通复制（字节数不变）");
    }
}

/**
 * 跨媒体借片段（设计规格 §5.2）：本体没有这个片段，但 `sources[clipId]` 指向同系列条目。
 *
 * 样本照抄《草莓棉花糖》：本体 6917（无片段），来源 6648（OVA 第2期，1 个片段）。
 */
class BorrowedClipTest {

    @TempDir
    Path assetRoot;

    @TempDir
    Path workDir;

    private static final long OWNER = 6917L;
    private static final long SOURCE = 6648L;
    private static final long BORROWED_CLIP = 900L;

    /** 物化产物：READY + 文件在场 + 区间与 clip 一致 → 走「零重编码直通」，测试环境不需要 ffmpeg。 */
    private VideoAsset asset(Path root, String relative, long durationMs) {
        VideoAsset videoAsset = new VideoAsset();
        videoAsset.setId(555L);
        videoAsset.setAvailabilityState("AVAILABLE");
        videoAsset.setStoragePath(relative);
        videoAsset.setDurationMs(durationMs);
        videoAsset.setVideoCodec("h264");
        videoAsset.setAudioCodec("aac");
        return videoAsset;
    }

    private Clip borrowedClip(long assetId) {
        Clip clip = new Clip();
        clip.setId(BORROWED_CLIP);
        clip.setTitle("OVA 那一段");
        clip.setStartMs(10_000L);
        clip.setEndMs(20_000L);
        clip.setTimestampSec(10d);
        clip.setEndSec(20d);
        clip.setVideoAssetId(assetId);
        return clip;
    }

    private RecommendClipSourceService service(ClipMapper clipMapper, VideoAssetMapper assetMapper,
                                               LocalVideoResolver resolver, MediaProbe probe,
                                               RelatedMediaService related, com.videotagger.mapper.MediaMapper mediaMapper) {
        ClipExportProperties properties = new ClipExportProperties();
        properties.setFfmpegPath("no-such-ffmpeg-binary");
        properties.setTaskTimeoutSec(5);
        return new RecommendClipSourceService(clipMapper, resolver, properties, assetMapper, probe,
                assetRoot.toString(), 30, related, mediaMapper, null);
    }

    private RelatedMediaService relatedService() {
        com.videotagger.mapper.ExternalRelationMapper mapper = mock(com.videotagger.mapper.ExternalRelationMapper.class);
        when(mapper.listLinkedMedia(OWNER)).thenReturn(List.of(
                new LinkedRelation("番外篇", "草莓棉花糖 OVA 第2期", SOURCE, 2007, 1L)));
        return new RelatedMediaService(mapper);
    }

    @Test
    void borrowsClipFromRelatedEntryAndCarriesSourceTitle() throws Exception {
        Path artifact = assetRoot.resolve("ova.mp4");
        Files.write(artifact, new byte[2048]);

        ClipMapper clipMapper = mock(ClipMapper.class);
        when(clipMapper.listByMedia(OWNER)).thenReturn(List.of());          // 本体没有片段
        when(clipMapper.listByMedia(SOURCE)).thenReturn(List.of(borrowedClip(555L)));
        when(clipMapper.selectById(BORROWED_CLIP)).thenReturn(borrowedClip(555L));

        VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
        when(assetMapper.selectById(555L)).thenReturn(asset(assetRoot, "ova.mp4", 10_000L));

        MediaProbe probe = mock(MediaProbe.class);
        when(probe.codecs(anyString())).thenReturn(new MediaProbe.Codecs("h264", "aac", true));
        when(probe.fps(anyString())).thenReturn(30d);

        RecommendClipSourceService.PreparedClips result = service(clipMapper, assetMapper,
                mock(LocalVideoResolver.class), probe, relatedService(), null)
                .prepare(Map.of(OWNER, new RecommendMediaClips(List.of(BORROWED_CLIP), null,
                        Map.of(BORROWED_CLIP, SOURCE))), workDir);

        assertTrue(result.missing().isEmpty(), "借片段不该被记为缺失");
        List<RecommendClipSourceService.PreparedClip> clips = result.byMedia().get(OWNER);
        assertEquals(1, clips.size());
        assertEquals(SOURCE, clips.get(0).sourceMediaId());
        assertEquals("草莓棉花糖 OVA 第2期", clips.get(0).sourceTitle());
    }

    @Test
    void rejectsClipWhoseSourceHasNoVideoRelation() {
        ClipMapper clipMapper = mock(ClipMapper.class);
        when(clipMapper.listByMedia(OWNER)).thenReturn(List.of());
        when(clipMapper.listByMedia(9999L)).thenReturn(List.of());          // 来源媒体压根没这个片段

        RecommendClipSourceService.PreparedClips result = service(clipMapper, mock(VideoAssetMapper.class),
                mock(LocalVideoResolver.class), mock(MediaProbe.class), relatedService(), null)
                .prepare(Map.of(OWNER, new RecommendMediaClips(List.of(BORROWED_CLIP), null,
                        Map.of(BORROWED_CLIP, 9999L))), workDir);

        // 9999 不在同系列里 → 报「没有视频类关联」（不是笼统的“不属于所选媒体”）
        assertEquals(1, result.missing().size());
        assertTrue(result.missing().get(0).reason().contains("没有视频类关联"),
                "实际文案：" + result.missing().get(0).reason());
    }

    @Test
    void oldDraftWithoutSourcesKeepsOldBehaviour() {
        ClipMapper clipMapper = mock(ClipMapper.class);
        when(clipMapper.listByMedia(OWNER)).thenReturn(List.of());

        RecommendClipSourceService.PreparedClips result = service(clipMapper, mock(VideoAssetMapper.class),
                mock(LocalVideoResolver.class), mock(MediaProbe.class), relatedService(), null)
                .prepare(Map.of(OWNER, new RecommendMediaClips(List.of(BORROWED_CLIP), null)), workDir);

        assertEquals(1, result.missing().size());
        assertEquals("片段不存在或不属于所选媒体", result.missing().get(0).reason());
    }

    @Test
    void ownedClipStillHasNoSourceFields() throws Exception {
        Path artifact = assetRoot.resolve("own.mp4");
        Files.write(artifact, new byte[1024]);

        ClipMapper clipMapper = mock(ClipMapper.class);
        when(clipMapper.listByMedia(OWNER)).thenReturn(List.of(borrowedClip(555L)));

        VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
        when(assetMapper.selectById(555L)).thenReturn(asset(assetRoot, "own.mp4", 10_000L));

        MediaProbe probe = mock(MediaProbe.class);
        when(probe.codecs(anyString())).thenReturn(new MediaProbe.Codecs("h264", "aac", true));
        when(probe.fps(anyString())).thenReturn(30d);

        RecommendClipSourceService.PreparedClips result = service(clipMapper, assetMapper,
                mock(LocalVideoResolver.class), probe, relatedService(), null)
                .prepare(Map.of(OWNER, new RecommendMediaClips(List.of(BORROWED_CLIP), null)), workDir);

        List<RecommendClipSourceService.PreparedClip> clips = result.byMedia().get(OWNER);
        assertEquals(1, clips.size());
        assertNull(clips.get(0).sourceMediaId());
        assertNull(clips.get(0).sourceTitle());
    }
}

/**
 * 旧草稿的「跨媒体悬空引用」：片段其实在库里、属于同系列的 OVA，但草稿没写 `sources`。
 *
 * 这是用户 2026-09-20 实际踩到的形态（草稿 6917《草莓棉花糖》里挂着属于 6648《OVA 第2期》的片段 182）：
 * 后端必须能认出「该挂到哪」，编辑器才能给一键修复，而不是只报「不属于所选媒体」。
 */
class DanglingCrossMediaRefTest {

    @TempDir
    Path assetRoot;

    @TempDir
    Path workDir;

    private static final long OWNER = 6917L;
    private static final long OVA = 6648L;
    private static final long BORROWED = 182L;

    private RecommendClipSourceService service(ClipMapper clipMapper, RelatedMediaService related,
                                               com.videotagger.mapper.EpisodeMapper episodeMapper) {
        ClipExportProperties properties = new ClipExportProperties();
        properties.setFfmpegPath("no-such-ffmpeg-binary");
        properties.setTaskTimeoutSec(5);
        return new RecommendClipSourceService(clipMapper, mock(LocalVideoResolver.class), properties,
                mock(VideoAssetMapper.class), mock(MediaProbe.class), assetRoot.toString(), 30,
                related, null, episodeMapper);
    }

    private RelatedMediaService relatedService() {
        com.videotagger.mapper.ExternalRelationMapper mapper = mock(com.videotagger.mapper.ExternalRelationMapper.class);
        when(mapper.listLinkedMedia(OWNER)).thenReturn(List.of(
                new LinkedRelation("番外篇", "草莓棉花糖 OVA 第2期", OVA, 2007, 1L)));
        return new RelatedMediaService(mapper);
    }

    @Test
    void suggestsRelatedSourceForDanglingReference() {
        Clip clip = new Clip();
        clip.setId(BORROWED);
        clip.setTitle("OVA 那一段");
        clip.setEpisodeId(2313L);

        ClipMapper clipMapper = mock(ClipMapper.class);
        when(clipMapper.listByMedia(OWNER)).thenReturn(List.of());        // 本体没有
        when(clipMapper.selectById(BORROWED)).thenReturn(clip);           // 但库里存在

        com.videotagger.entity.Episode episode = new com.videotagger.entity.Episode();
        episode.setId(2313L);
        episode.setMediaId(OVA);
        com.videotagger.mapper.EpisodeMapper episodeMapper = mock(com.videotagger.mapper.EpisodeMapper.class);
        when(episodeMapper.selectById(2313L)).thenReturn(episode);

        RecommendClipSourceService.PreparedClips result = service(clipMapper, relatedService(), episodeMapper)
                .prepare(Map.of(OWNER, new RecommendMediaClips(List.of(BORROWED), null)), workDir);

        assertEquals(1, result.missing().size());
        RecommendClipSourceService.MissingClip missing = result.missing().get(0);
        assertEquals(OVA, missing.suggestedSourceMediaId(), "应建议挂到 OVA 那个媒体");
        assertEquals("草莓棉花糖 OVA 第2期", missing.suggestedSourceTitle());
    }

    @Test
    void noSuggestionWhenClipBelongsToUnrelatedMedia() {
        Clip clip = new Clip();
        clip.setId(BORROWED);
        clip.setEpisodeId(2313L);

        ClipMapper clipMapper = mock(ClipMapper.class);
        when(clipMapper.listByMedia(OWNER)).thenReturn(List.of());
        when(clipMapper.selectById(BORROWED)).thenReturn(clip);

        com.videotagger.entity.Episode episode = new com.videotagger.entity.Episode();
        episode.setId(2313L);
        episode.setMediaId(9999L);                                        // 与本体毫无关联
        com.videotagger.mapper.EpisodeMapper episodeMapper = mock(com.videotagger.mapper.EpisodeMapper.class);
        when(episodeMapper.selectById(2313L)).thenReturn(episode);

        RecommendClipSourceService.PreparedClips result = service(clipMapper, relatedService(), episodeMapper)
                .prepare(Map.of(OWNER, new RecommendMediaClips(List.of(BORROWED), null)), workDir);

        assertEquals(1, result.missing().size());
        assertNull(result.missing().get(0).suggestedSourceMediaId(), "不在同系列里就不该瞎建议");
    }
}
