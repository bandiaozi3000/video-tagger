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
import static org.junit.jupiter.api.Assertions.assertTrue;
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
        ClipExportProperties properties = new ClipExportProperties();
        properties.setFfmpegPath("no-such-ffmpeg-binary");
        properties.setTaskTimeoutSec(5);
        return new RecommendClipSourceService(clipMapper, resolver, properties, assetMapper, probe, assetRoot.toString());
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
}
