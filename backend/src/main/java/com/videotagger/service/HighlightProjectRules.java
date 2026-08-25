package com.videotagger.service;

import com.videotagger.entity.HighlightProjectItem;

final class HighlightProjectRules {
    private HighlightProjectRules() { }

    static void validateRange(Double in, Double out) {
        if (in == null || in < 0) throw new IllegalArgumentException("片段开始时间必须大于等于 0");
        if (out == null || out <= in) throw new IllegalArgumentException("片段结束时间必须大于开始时间");
    }

    static void requireReady(HighlightProjectItem item) {
        if (!"READY".equals(item.getSourceState())) {
            throw new IllegalArgumentException("时间线中存在未就绪素材，请先准备、上传或移除："
                    + (item.getSourceMessage() == null ? "片段 #" + item.getId() : item.getSourceMessage()));
        }
    }

    static int selectableCount(String mode, String... spoilerStates) {
        int count = 0;
        for (String state : spoilerStates) {
            if ("FULL".equals(mode) || "SAFE".equals(state)) count++;
        }
        return count;
    }
}
