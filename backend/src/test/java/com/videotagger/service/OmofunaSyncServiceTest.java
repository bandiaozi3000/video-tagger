package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Media;
import com.videotagger.mapper.MediaMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** OmofunaSyncService 导入逻辑单测：读 JSON 逐条 upsert（纯 JUnit + Mockito，无需 MockWebServer）。 */
class OmofunaSyncServiceTest {

    @TempDir
    Path tmpDir;

    private MediaMapper mediaMapper;
    private CoverService coverService;
    private OmofunaSyncService service;

    @BeforeEach
    void setUp() {
        mediaMapper = mock(MediaMapper.class);
        coverService = mock(CoverService.class);
        service = new OmofunaSyncService(mediaMapper, coverService, new ObjectMapper());
    }

    private Path writeJson(String body) throws Exception {
        Path p = tmpDir.resolve("omofuna.json");
        Files.writeString(p, body);
        return p;
    }

    @Test
    void importsItemsCreatesMediaWithChineseTitle() throws Exception {
        Path json = writeJson("""
                {"items":[{"title":"轻松熊","year":2026,"coverUrl":"https://x/1.webp","hash":"h1","categoryId":1}]}
                """);

        OmofunaSyncService.SyncResult r = service.importFromJson(json);

        assertEquals(1, r.added());
        assertEquals(0, r.skipped());
        org.mockito.ArgumentCaptor<Media> captor = org.mockito.ArgumentCaptor.forClass(Media.class);
        verify(mediaMapper).insert(captor.capture());
        Media m = captor.getValue();
        assertEquals("轻松熊", m.getTitle());
        assertEquals(2026, m.getYear());
        assertEquals("VIDEO", m.getMediaFormat());
        assertEquals("WANT", m.getStatus());
        assertEquals(1, m.getConfirmed());
        verify(coverService, never()).downloadAsync(any(), any());
    }

    @Test
    void duplicateTitleSkipped() throws Exception {
        when(mediaMapper.selectByTitleOrOriginal("轻松熊")).thenReturn(new Media());
        Path json = writeJson("""
                {"items":[{"title":"轻松熊","year":2026,"coverUrl":"https://x/1.webp"}]}
                """);

        OmofunaSyncService.SyncResult r = service.importFromJson(json);

        assertEquals(0, r.added());
        assertEquals(1, r.skipped());
        verify(mediaMapper, never()).insert(any(Media.class));
    }

    @Test
    void duplicateDoesNotMutateLocalCover() throws Exception {
        Media existing = new Media();
        existing.setId(88L);
        when(mediaMapper.selectByTitleOrOriginal("轻松熊")).thenReturn(existing);
        Path json = writeJson("""
                {"items":[{"title":"轻松熊","year":2026,"coverUrl":"https://x/1.webp"}]}
                """);

        OmofunaSyncService.SyncResult r = service.importFromJson(json);

        assertEquals(0, r.added());
        assertEquals(1, r.skipped());
        verify(mediaMapper, never()).updateById(existing);
        verify(coverService, never()).downloadAsync(any(), any());
    }

    @Test
    void blankTitleIgnored() throws Exception {
        Path json = writeJson("""
                {"items":[{"title":"   ","year":2026,"coverUrl":"https://x/1.webp"}]}
                """);

        OmofunaSyncService.SyncResult r = service.importFromJson(json);

        assertEquals(0, r.added());
        assertEquals(0, r.skipped());
        verify(mediaMapper, never()).insert(any(Media.class));
    }

    @Test
    void coverNullSkipsDownload() throws Exception {
        Path json = writeJson("""
                {"items":[{"title":"无封面番","year":2026,"coverUrl":null}]}
                """);

        OmofunaSyncService.SyncResult r = service.importFromJson(json);

        assertEquals(1, r.added());
        verify(coverService, never()).downloadAsync(any(), any());
    }
}
