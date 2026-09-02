package com.videotagger.videosource;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;

class VideoSourceTitleMatcherTest {
    @Test
    void normalizesMarkersAndPunctuationForSearch() {
        assertEquals("少女与战车", VideoSourceTitleMatcher.searchKeyword("剧场版：少女与战车", true, false));
        assertEquals("Girls", VideoSourceTitleMatcher.searchKeyword("Girls und Panzer", false, true));
    }

    @Test
    void treatsDecoratedSourceTitleAsStrongMatch() {
        assertTrue(VideoSourceTitleMatcher.matches("少女与战车", "少女与战车 TV版（全12话）"));
        assertTrue(VideoSourceTitleMatcher.score("Girls und Panzer", "Girls und Panzer") > 90);
    }

    @Test
    void rejectsSameEpisodeNumberFromAnotherSeries() {
        VideoSourceDiscoveryQuery query = new VideoSourceDiscoveryQuery(1L, Map.of(), Map.of(),
                List.of("目标番剧"), List.of("第1集"), 2026, null, "VIDEO", null, 1, 1, 0, 20);
        VideoSourcePackage sourcePackage = new VideoSourcePackage("web", "pkg", "r1", "另一部番剧",
                null, 2026, null, "TV", null, List.of(), List.of(), null, null, null, Set.of(), null,
                Map.of(), List.of());
        VideoSourceItem item = new VideoSourceItem("web", "pkg", "item", "r1",
                VideoSourceStatus.ItemKind.EPISODE, 1, null, "第1集", null, List.of(), List.of(), null,
                Set.of(), null, Map.of());
        assertTrue(!VideoSourceTitleMatcher.match(query, sourcePackage, item).accepted());
    }

    @Test
    void acceptsExactTitleAndEpisodeAndReportsReason() {
        VideoSourceDiscoveryQuery query = new VideoSourceDiscoveryQuery(1L, Map.of(), Map.of(),
                List.of("目标番剧"), List.of("第一集"), 2026, null, "VIDEO", null, 1, 1, 0, 20);
        VideoSourcePackage sourcePackage = new VideoSourcePackage("web", "pkg", "r1", "目标番剧",
                null, 2026, null, "TV", null, List.of(), List.of(), null, null, null, Set.of(), null,
                Map.of(), List.of());
        VideoSourceItem item = new VideoSourceItem("web", "pkg", "item", "r1",
                VideoSourceStatus.ItemKind.EPISODE, 1, null, "第一集", null, List.of(), List.of(), null,
                Set.of(), null, Map.of());
        var result = VideoSourceTitleMatcher.match(query, sourcePackage, item);
        assertTrue(result.accepted());
        assertEquals("EXACT_TITLE_EPISODE", result.level());
    }

    @Test
    void rejectsUnrequestedDerivativeSeries() {
        VideoSourceDiscoveryQuery query = new VideoSourceDiscoveryQuery(1L, Map.of(), Map.of(),
                List.of("少女与战车"), List.of("第二集"), 2012, "0", "TV", 12, 2, 2, 0, 20);
        VideoSourcePackage sourcePackage = new VideoSourcePackage("web", "pkg", "r1", "少女与战车 最终章",
                null, 2023, null, "MOVIE", null, List.of(), List.of(), null, null, null, Set.of(), null,
                Map.of(), List.of());
        VideoSourceItem item = new VideoSourceItem("web", "pkg", "item", "r1",
                VideoSourceStatus.ItemKind.EPISODE, 2, null, "第2集", null, List.of(), List.of(), null,
                Set.of(), null, Map.of());
        assertTrue(!VideoSourceTitleMatcher.match(query, sourcePackage, item).accepted());
    }
}
