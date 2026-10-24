package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 资源视频上传：文件落本地池的命名约定 + 无集片段行的取值（推荐侧靠这两点才零改动）。 */
class ClipUploadServiceTest {
    @TempDir
    Path temp;

    private ClipUploadService serviceWith(double probedDuration) {
        ClipExportProperties properties = new ClipExportProperties();
        properties.setVideoDir(temp.toString());
        MediaProbe probe = mock(MediaProbe.class);
        when(probe.durationSeconds(any())).thenReturn(probedDuration);
        // insert 只写库：用 mock 截住，测试只关心被写进去的那一行
        ClipMapper mapper = mock(ClipMapper.class);
        return new ClipUploadService(mapper, probe, properties);
    }

    @Test
    void storesFileByNameFingerprintAndRegistersEpisodeLessClip() throws Exception {
        byte[] body = "resource-bytes".getBytes();
        String expectedFp = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
        ClipExportProperties properties = new ClipExportProperties();
        properties.setVideoDir(temp.toString());
        MediaProbe probe = mock(MediaProbe.class);
        when(probe.durationSeconds(any())).thenReturn(90.0);
        ClipMapper mapper = mock(ClipMapper.class);
        ClipUploadService service = new ClipUploadService(mapper, probe, properties);

        Clip clip = service.upload(new MockMultipartFile("file", "NCOP.mkv", "video/x-matroska", body), null, 5.0, 20.0);

        // 文件名 = 指纹 + 原扩展名（LocalVideoResolver 就按这个名字找）
        assertTrue(Files.isRegularFile(temp.resolve(expectedFp + ".mkv")), "指纹命名的源文件应在场");
        assertEquals("upload://" + expectedFp, clip.getUrl());
        assertEquals(expectedFp, clip.getVideoFp());
        assertNull(clip.getEpisodeId(), "资源视频不属于任何一集");
        assertEquals("NCOP", clip.getTitle(), "标题缺省取原文件名（去扩展名）");
        assertEquals(5.0, clip.getTimestampSec());
        assertEquals(20.0, clip.getEndSec());
        assertEquals(90.0, clip.getVideoDuration());
        assertEquals(5000L, clip.getStartMs());
        assertEquals(20000L, clip.getEndMs());
    }

    @Test
    void clampsEndToDurationAndDefaultsToWholeFile() throws Exception {
        ClipUploadService service = serviceWith(30.0);
        Clip clip = service.upload(new MockMultipartFile("file", "op.mp4", "video/mp4", new byte[]{1, 2, 3}), "OP1", null, 999.0);
        assertEquals("OP1", clip.getTitle());
        assertEquals(0.0, clip.getTimestampSec());
        assertEquals(30.0, clip.getEndSec(), "结尾超出时长 → 收敛到整段");
    }

    @Test
    void rejectsUndecodableFileAndDeletesIt() throws Exception {
        ClipUploadService service = serviceWith(0.0);
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain", new byte[]{1, 2, 3});
        assertThrows(IllegalArgumentException.class, () -> service.upload(file, null, null, null));
        try (var stream = Files.list(temp)) {
            assertEquals(0, stream.count(), "探测失败的文件必须删掉，不留垃圾");
        }
    }

    @Test
    void rejectsStartBeyondDuration() throws Exception {
        ClipUploadService service = serviceWith(10.0);
        MockMultipartFile file = new MockMultipartFile("file", "op.mp4", "video/mp4", new byte[]{1, 2, 3});
        assertThrows(IllegalArgumentException.class, () -> service.upload(file, null, 12.0, null));
    }
}
