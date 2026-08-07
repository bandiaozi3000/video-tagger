package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Media;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.util.VideoFingerprint;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 帧封面：截帧落盘/删除、集封面自选拷贝、base64 解码、级联清理与代表性兜底解析。 */
class CoverServiceIT extends AbstractMySqlIT {

    @Autowired
    CoverService coverService;
    @Autowired
    ClipService clipService;
    @Autowired
    MediaService mediaService;
    @Autowired
    EpisodeService episodeService;
    @Autowired
    ClipMapper clipMapper;
    @Autowired
    EpisodeMapper episodeMapper;
    @Autowired
    MediaMapper mediaMapper;

    private static byte[] frameBytes() {
        return new byte[]{1, 2, 3, 4, 5};
    }

    private static String dataUrl() {
        return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(frameBytes());
    }

    private Path fileOf(String coverPath) {
        return coverService.dir().resolve(coverPath.substring("/covers/".length()));
    }

    @Test
    void decodeDataUrlSupportsPrefixAndRawBase64() {
        byte[] bytes = frameBytes();
        String raw = Base64.getEncoder().encodeToString(bytes);
        assertArrayEquals(bytes, coverService.decodeDataUrl("data:image/jpeg;base64," + raw));
        assertArrayEquals(bytes, coverService.decodeDataUrl(raw));
        assertThrows(IllegalArgumentException.class, () -> coverService.decodeDataUrl("@@not-base64@@"));
        assertThrows(IllegalArgumentException.class, () -> coverService.decodeDataUrl(" "));
    }

    @Test
    void clipCoverSavedAndDeleted() {
        String path = coverService.saveClipCover(42L, frameBytes());
        assertEquals("/covers/clip/42.jpg", path);
        assertTrue(Files.exists(fileOf(path)));

        coverService.deleteCover(path);
        assertFalse(Files.exists(fileOf(path)));
    }

    @Test
    void clipDetailCoverSavedAndDeleted() {
        String path = coverService.saveClipDetailCover(88L, frameBytes());
        assertEquals("/covers/clip/88-xl.jpg", path);
        assertTrue(Files.exists(fileOf(path)));

        coverService.deleteCover(path);
        assertFalse(Files.exists(fileOf(path)));
    }

    @Test
    void dualCoverSavedAndDeletedTogether() {
        // 缩略图 + 详情大图一起随保存落盘
        SaveClipResult r = clipService.save(new SaveClipRequest(
                "某动画F 第1集", "https://dual.com/1", 10.0, "高燃", "",
                null, null, dataUrl(), dataUrl()));
        Clip clip = clipMapper.selectById(r.id());
        assertNotNull(clip.getCoverPath());
        assertNotNull(clip.getDetailCoverPath());
        assertTrue(clip.getDetailCoverPath().endsWith("-xl.jpg"));
        assertTrue(Files.exists(fileOf(clip.getCoverPath())));
        assertTrue(Files.exists(fileOf(clip.getDetailCoverPath())));

        // 删片段连带删两张图
        assertTrue(clipService.delete(r.id()));
        assertFalse(Files.exists(fileOf(clip.getCoverPath())));
        assertFalse(Files.exists(fileOf(clip.getDetailCoverPath())));
    }

    @Test
    void episodeCoverVersionedAndCleanedOnReplace() {
        String p1 = coverService.saveEpisodeCover(7L, frameBytes());
        String p2 = coverService.saveEpisodeCover(7L, frameBytes());
        assertTrue(p1.startsWith("/covers/ep/7-"));
        assertTrue(p2.startsWith("/covers/ep/7-"));
        // 替换后旧版本文件被清理，只剩新文件
        assertTrue(Files.exists(fileOf(p2)));
        assertFalse(Files.exists(fileOf(p1)));
    }

    @Test
    void episodeCoverFromClipCopiesBytes() {
        coverService.saveClipCover(9L, frameBytes());
        String epPath = coverService.saveEpisodeCoverFromClip(9L, 9L);
        assertTrue(epPath.startsWith("/covers/ep/9-"));
        try {
            assertArrayEquals(frameBytes(), Files.readAllBytes(fileOf(epPath)));
        } catch (Exception e) {
            throw new AssertionError(e);
        }
        // 片段无封面时报错
        assertThrows(IllegalStateException.class, () -> coverService.saveEpisodeCoverFromClip(9L, 999L));
    }

    @Test
    void deleteCoverRejectsTraversal() {
        // 越界/非封面前缀/空值：静默拒绝，不抛异常
        coverService.deleteCover("/covers/../../etc/passwd");
        coverService.deleteCover("/not-covers/x.jpg");
        coverService.deleteCover(null);
    }

    @Test
    void saveWithCoverDataUrlPersistsClipCover() {
        SaveClipResult r = clipService.save(new SaveClipRequest(
                "某动画A 第1集", "https://cover.com/1", 10.0, "高燃", "", null, null, dataUrl(), null));

        Clip clip = clipMapper.selectById(r.id());
        assertNotNull(clip.getCoverPath());
        assertTrue(clip.getCoverPath().startsWith("/covers/clip/"));
        assertTrue(Files.exists(fileOf(clip.getCoverPath())));

        // 删除片段连带删除封面文件
        assertTrue(clipService.delete(r.id()));
        assertFalse(Files.exists(fileOf(clip.getCoverPath())));
        assertNull(clipMapper.selectById(r.id()));
    }

    @Test
    void representativeCoverPicksMostTaggedClip() {
        // 同一集两条片段都带截帧，第一条标签更多 → 代表性封面应指向第一条
        SaveClipResult c1 = clipService.save(new SaveClipRequest(
                "某动画B 第2集", "https://cover.com/2", 10.0, "高燃 战斗 名场面", "",
                null, null, dataUrl(), null));
        clipService.save(new SaveClipRequest(
                "某动画B 第2集", "https://cover.com/2", 50.0, "泪目", "",
                null, null, dataUrl(), null));

        String fp = VideoFingerprint.fingerprint("https://cover.com/2");
        Episode ep = episodeMapper.selectByFp(fp);
        assertNotNull(ep);

        String rep = clipMapper.selectRepresentativeCoverByEpisode(ep.getId());
        assertEquals("/covers/clip/" + c1.id() + ".jpg", rep);
    }

    @Test
    void mediaFallbackCoverResolvesAndDeletesCascade() {
        SaveClipResult c = clipService.save(new SaveClipRequest(
                "某动画C 第3集", "https://cover.com/3", 10.0, "高燃", "",
                null, null, dataUrl(), null));
        Media a = mediaMapper.selectByTitlePrefix("某动画C");
        assertNotNull(a);
        assertNull(a.getCoverPath()); // 无 og:image 场景

        // 番剧详情返回代表性片段帧兜底
        MediaDetail detail = mediaService.get(a.getId());
        assertNotNull(detail.fallbackCoverPath());
        assertEquals("/covers/clip/" + c.id() + ".jpg", detail.fallbackCoverPath());

        // 番剧卡片墙（MediaSummary SQL 按位映射）同样返回兜底封面
        MediaSummary row = mediaService.list(10, 0, null, null, null, null, null, null, null, null).stream()
                .filter(s -> s.id().equals(a.getId())).findFirst().orElse(null);
        assertNotNull(row);
        assertEquals("/covers/clip/" + c.id() + ".jpg", row.fallbackCoverPath());

        // 删除番剧级联清理其下所有封面文件
        Clip clip = clipMapper.selectById(c.id());
        Path clipFile = fileOf(clip.getCoverPath());
        assertTrue(Files.exists(clipFile));
        mediaService.delete(a.getId());
        assertFalse(Files.exists(clipFile));
    }

    @Test
    void episodeDetailResolvesEffectiveCover() {
        SaveClipResult c = clipService.save(new SaveClipRequest(
                "某动画D 第4集", "https://cover.com/4", 10.0, "高燃", "",
                null, null, dataUrl(), null));
        Media a = mediaMapper.selectByTitlePrefix("某动画D");
        assertNotNull(a);

        List<EpisodeDetail> eps = mediaService.episodes(a.getId());
        assertEquals(1, eps.size());
        // 未显式设置集封面时，智能默认落到代表性片段帧
        assertEquals("/covers/clip/" + c.id() + ".jpg", eps.get(0).coverPath());

        // 自选某片段帧为集封面后，episode.cover_path 生效
        episodeService.setCoverFromClip(eps.get(0).id(), c.id());
        EpisodeDetail after = mediaService.episodes(a.getId()).get(0);
        assertTrue(after.coverPath().startsWith("/covers/ep/"));
    }

    @Test
    void episodeDeleteCascadesClipsCoversAndTags() {
        SaveClipResult c = clipService.save(new SaveClipRequest(
                "某动画G 第2集", "https://epdel.com/2", 10.0, "高燃", "",
                null, null, dataUrl(), dataUrl()));
        Clip clip = clipMapper.selectById(c.id());
        Episode ep = episodeMapper.selectByFp(clip.getVideoFp());
        assertNotNull(ep);
        assertTrue(Files.exists(fileOf(clip.getCoverPath())));
        assertTrue(Files.exists(fileOf(clip.getDetailCoverPath())));

        episodeService.delete(ep.getId());

        assertNull(episodeMapper.selectById(ep.getId()));
        assertNull(clipMapper.selectById(c.id()));
        assertFalse(Files.exists(fileOf(clip.getCoverPath())));
        assertFalse(Files.exists(fileOf(clip.getDetailCoverPath())));
    }

    @Test
    void episodeDetailBuildsFullInfo() {
        SaveClipResult c = clipService.save(new SaveClipRequest(
                "某动画E 第5集", "https://epd.com/5", 30.0, "高燃", "", null, null, dataUrl(), null));
        String fp = VideoFingerprint.fingerprint("https://epd.com/5");
        Episode ep = episodeMapper.selectByFp(fp);
        assertNotNull(ep);

        EpisodeDetail d = episodeService.detail(ep.getId());
        assertEquals(ep.getId(), d.id());
        assertEquals(5, d.episodeNo());
        assertEquals(1, d.clipCount());
        assertNotNull(d.latestAt());
        assertNotNull(d.videoFp());
        // 无显式集封面时解析到代表性片段帧
        assertEquals("/covers/clip/" + c.id() + ".jpg", d.coverPath());
    }
}
