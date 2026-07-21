package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RrfFusionTest {

    @Test
    void itemInBothListsRanksFirst() {
        // id=2 同时出现在两路召回，融合后应排第一
        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(60, List.of(
                List.of(1L, 2L),
                List.of(2L, 3L)
        ));

        assertEquals(List.of(2L, 1L, 3L), List.copyOf(fused.keySet()));
    }

    @Test
    void emptyListsReturnEmpty() {
        assertEquals(0, RrfFusion.fuse(60, List.of(List.of(), List.of())).size());
    }
}
