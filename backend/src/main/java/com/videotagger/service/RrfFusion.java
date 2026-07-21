package com.videotagger.service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class RrfFusion {

    private RrfFusion() {
    }

    /** RRF 融合：score = Σ 1/(k + rank)，rank 从 1 开始；返回按分数降序的有序 Map */
    public static LinkedHashMap<Long, Double> fuse(int k, List<List<Long>> rankedLists) {
        Map<Long, Double> scores = new HashMap<>();
        for (List<Long> list : rankedLists) {
            for (int i = 0; i < list.size(); i++) {
                scores.merge(list.get(i), 1.0 / (k + i + 1), Double::sum);
            }
        }
        return scores.entrySet().stream()
                .sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue,
                        (a, b) -> a, LinkedHashMap::new));
    }
}
