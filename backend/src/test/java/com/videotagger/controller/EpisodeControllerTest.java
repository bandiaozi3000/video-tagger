package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.service.EpisodeReviewService;
import com.videotagger.service.EpisodeService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EpisodeControllerTest {
    @Test
    void listsClipsByEpisodeIdentityInsteadOfLegacyVideoFingerprint() throws Exception {
        EpisodeService service = mock(EpisodeService.class);
        Clip clip = new Clip();
        clip.setId(9L);
        clip.setEpisodeId(7L);
        clip.setVideoAssetId(11L);
        clip.setStartMs(12_345L);
        when(service.clips(7L)).thenReturn(List.of(clip));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new EpisodeController(service, mock(EpisodeReviewService.class))).build();

        mvc.perform(get("/api/episodes/7/clips").accept(APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(9))
                .andExpect(jsonPath("$[0].episodeId").value(7))
                .andExpect(jsonPath("$[0].videoAssetId").value(11))
                .andExpect(jsonPath("$[0].startMs").value(12_345));
    }
}
