package com.videotagger.controller;

import com.videotagger.service.AniListSyncService;
import com.videotagger.service.CoverService;
import com.videotagger.service.EpisodeService;
import com.videotagger.service.HighlightProjectService;
import com.videotagger.service.MediaService;
import com.videotagger.service.RelatedMediaService;
import com.videotagger.service.TagLinkService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * v0.32 筛选多选的**HTTP 契约**门禁：逗号串必须绑成 `List`。
 *
 * <p>为什么单独测这一层：`MediaFilterMultiIT` 走的是 service，验证不到 Spring 的参数绑定；
 * 而「`?year=2020,2021` → `List<Integer>`」这层一旦不成立，前端全维度多选直接 400。
 * 同时钉住**单值调用方**（Remotion 编辑器的候选筛选只发单值）仍然合法 —— 这是本次不改编辑器的前提。
 */
@WebMvcTest(MediaController.class)
class MediaControllerFilterBindingTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    MediaService mediaService;
    @MockBean
    EpisodeService episodeService;
    @MockBean
    CoverService coverService;
    @MockBean
    AniListSyncService aniListSyncService;
    @MockBean
    HighlightProjectService highlightProjectService;
    @MockBean
    RelatedMediaService relatedMediaService;
    @MockBean
    TagLinkService tagLinkService;

    /** service.list(limit, offset, status, format, subcategoryId, confirmed, collectionId, sort, order, year,
     *  source, tagIds, tagMode, genreMode, collectionMode, q, ids, genres, season) */
    @Test
    void commaSeparatedParamsBindToLists() throws Exception {
        mvc.perform(get("/api/media")
                        .param("year", "2020,2021")
                        .param("status", "WATCHING,WANT")
                        .param("season", "SPRING,FALL")
                        .param("genres", "奇幻,战斗").param("genreMode", "AND")
                        .param("collectionId", "3,4").param("collectionMode", "AND"))
                .andExpect(status().isOk());

        verify(mediaService).list(50, 0, List.of("WATCHING", "WANT"), null, null, null, List.of(3L, 4L),
                null, null, List.of(2020, 2021), null, null, null, "AND", "AND", null, null,
                List.of("奇幻", "战斗"), List.of("SPRING", "FALL"));
    }

    /** 单值请求（编辑器在用）必须仍然合法，且不传 mode 时 mode = null（SQL 片段按缺省 OR 走）。 */
    @Test
    void singleValueStaysCompatible() throws Exception {
        mvc.perform(get("/api/media").param("year", "2020").param("status", "WATCHING")
                        .param("genres", "奇幻").param("collectionId", "3").param("tagIds", "7")
                        .param("tagMode", "AND"))
                .andExpect(status().isOk());

        verify(mediaService).list(50, 0, List.of("WATCHING"), null, null, null, List.of(3L),
                null, null, List.of(2020), null, List.of(7L), "AND", null, null, null, null,
                List.of("奇幻"), null);
    }

    /** 计数端点与列表同参：错位一条就是「列表 20 条、分页说 0 条」。 */
    @Test
    void countEndpointBindsTheSameWay() throws Exception {
        mvc.perform(get("/api/media/count").param("collectionId", "3,4").param("collectionMode", "AND")
                        .param("genres", "奇幻").param("genreMode", "AND"))
                .andExpect(status().isOk());

        verify(mediaService).count(null, null, null, null, List.of(3L, 4L), null, null, null, null,
                "AND", "AND", false, null, List.of("奇幻"), null);
    }
}
