package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ClipExportUploadTest {
    @TempDir
    Path temp;

    @Test
    void rejectsNonWebmFile() {
        ClipExportService service = service();
        MockMultipartFile file = new MockMultipartFile("file", "clip.mp4", "video/mp4", new byte[]{1, 2, 3, 4});
        assertThrows(IllegalArgumentException.class, () -> service.uploadBrowserVideo(1, file, false));
    }

    @Test
    void rejectsInvalidWebmHeader() {
        ClipExportService service = service();
        MockMultipartFile file = new MockMultipartFile("file", "clip.webm", "video/webm", new byte[]{1, 2, 3, 4});
        assertThrows(IllegalArgumentException.class, () -> service.uploadBrowserVideo(1, file, false));
    }

    @Test
    void storesWebmWithEbmlHeader() throws Exception {
        ClipExportService service = service();
        byte[] body = {0x1a, 0x45, (byte) 0xdf, (byte) 0xa3, 1, 2, 3};
        MockMultipartFile file = new MockMultipartFile("file", "clip.webm", "video/webm;codecs=vp9,opus", body);

        ClipExportTask task = service.uploadBrowserVideo(1, file, true);

        assertEquals("SUCCEEDED", task.status());
        assertEquals("browser-manual-stop", task.source());
        assertEquals(List.of("browser-video"), service.artifacts(1).stream().map(ClipExportArtifact::type).toList());
        assertEquals("browser-manual-stop", service.artifacts(1).get(0).source());
        assertEquals(body.length, Files.size(temp.resolve("videos").resolve("1.webm")));
    }

    private ClipExportService service() {
        ClipMapper mapper = mock(ClipMapper.class);
        Clip clip = new Clip();
        clip.setId(1L);
        clip.setTimestampSec(1.0);
        when(mapper.selectById(1L)).thenReturn(clip);
        ClipExportProperties properties = new ClipExportProperties();
        properties.setVideoDir(temp.resolve("source").toString());
        properties.setVideoOutputDir(temp.resolve("videos").toString());
        properties.setImageOutputDir(temp.resolve("images").toString());
        properties.setAllowedExtensions(List.of("mp4"));
        return new ClipExportService(mapper, properties, new LocalVideoResolver(properties));
    }
}
