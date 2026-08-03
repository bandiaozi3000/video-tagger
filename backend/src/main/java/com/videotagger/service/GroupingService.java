package com.videotagger.service;

import com.videotagger.entity.Anime;
import com.videotagger.mapper.AnimeMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * LLM 后台归组：每 10 分钟扫描待确认（confirmed=0）番剧，
 * 用 LLM 判断其标题是否与已知番剧是同一作品（别名 / 不同季 / 不同翻译 / 不同篇目），
 * 命中则合并到目标档案。纯后台任务，绝不进入打标主链路；未配置 LLM 时静默跳过。
 */
@Service
public class GroupingService {

    private static final Logger log = LoggerFactory.getLogger(GroupingService.class);

    private static final String SYSTEM = "你是番剧整理助手。判断标题是否属于同一部作品（含别名、不同季、不同翻译、不同篇目）。"
            + "若匹配，只回答候选列表中该作品的标题原文；若不匹配，只回答：无";

    private final LlmClient llmClient;
    private final AnimeMapper animeMapper;
    private final AnimeService animeService;

    public GroupingService(LlmClient llmClient, AnimeMapper animeMapper, AnimeService animeService) {
        this.llmClient = llmClient;
        this.animeMapper = animeMapper;
        this.animeService = animeService;
    }

    @Scheduled(fixedDelay = 600_000)
    public void reconcile() {
        if (!llmClient.isConfigured()) {
            return;
        }
        List<Anime> all;
        try {
            all = animeMapper.selectList(null);
        } catch (Exception e) {
            log.warn("LLM 归组扫描失败：{}", e.getMessage());
            return;
        }
        List<Anime> unconfirmed = all.stream()
                .filter(a -> a.getConfirmed() != null && a.getConfirmed() == 0)
                .toList();
        if (unconfirmed.isEmpty()) {
            return;
        }
        for (Anime a : unconfirmed) {
            try {
                resolve(a, all);
            } catch (Exception e) {
                log.warn("番剧 {} 归组判断失败：{}", a.getId(), e.getMessage());
            }
        }
    }

    private void resolve(Anime a, List<Anime> all) {
        // 粗糙预筛候选：标题含相同子串，避免给 LLM 全量列表（个人库数量级不大）
        List<Anime> candidates = all.stream()
                .filter(k -> !k.getId().equals(a.getId()))
                .filter(k -> roughMatch(a.getTitle(), k.getTitle()))
                .limit(8)
                .toList();
        if (candidates.isEmpty()) {
            return;
        }
        StringBuilder sb = new StringBuilder("已知番剧列表：\n");
        for (int i = 0; i < candidates.size(); i++) {
            sb.append(i + 1).append(". ").append(candidates.get(i).getTitle()).append('\n');
        }
        sb.append("\n标题「").append(a.getTitle())
                .append("」是否与其中某一部是同一作品（含别名/不同季/不同翻译/不同篇目）？");
        String resp = llmClient.chat(SYSTEM, sb.toString());
        if (resp == null || resp.isBlank() || resp.contains("无")) {
            return;
        }
        for (Anime c : candidates) {
            if (c.getTitle().length() >= 2 && resp.contains(c.getTitle())) {
                log.info("LLM 归组：{}(id={}) 合并到 {}(id={})", a.getTitle(), a.getId(), c.getTitle(), c.getId());
                animeService.merge(a.getId(), c.getId());
                return;
            }
        }
    }

    /** 粗糙预筛：互含子串或词重叠，避免对不相关标题调用 LLM。 */
    static boolean roughMatch(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        if (a.length() < 2 || b.length() < 2) {
            return false;
        }
        if (a.contains(b) || b.contains(a)) {
            return true;
        }
        for (String w : b.split("\\s+")) {
            if (w.length() >= 2 && a.contains(w)) {
                return true;
            }
        }
        return false;
    }
}
