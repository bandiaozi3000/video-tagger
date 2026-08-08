package com.videotagger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Media;
import com.videotagger.mapper.MediaMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Path;

/**
 * omofuna 抓取产物导入：读 node omofuna.js 输出的 JSON，逐条 upsert 建媒体档案。
 *
 * 与 AniList 同步的区别：omofuna 只有中文标题，无日文原名 → {@code originalTitle} 显式留空，
 * 使「AniList 日文牌 + omofuna 中文牌」并存，用户靠既有 merge 功能手动合并（grilling 已拍板）。
 * 查重用 {@link MediaMapper#selectByTitleOrOriginal}（title 或 original_title 精确匹配）命中跳过。
 * 封面走 {@link CoverService#downloadAsync}（复用 coverExecutor，失败静默降级），不阻塞导入主链路。
 */
@Service
public class OmofunaSyncService {

    private static final Logger log = LoggerFactory.getLogger(OmofunaSyncService.class);

    /** 导入结果：新增 / 跳过（命中库中已有）。 */
    public record SyncResult(int added, int skipped) {
    }

    private final MediaMapper mediaMapper;
    private final CoverService coverService;
    private final ObjectMapper objectMapper;

    public OmofunaSyncService(MediaMapper mediaMapper, CoverService coverService, ObjectMapper objectMapper) {
        this.mediaMapper = mediaMapper;
        this.coverService = coverService;
        this.objectMapper = objectMapper;
    }

    /** 读 omofuna.json，逐条导入。空 title 脏数据忽略不计。 */
    public SyncResult importFromJson(Path json) throws IOException {
        JsonNode root = objectMapper.readTree(json.toFile());
        JsonNode items = root.path("items");
        int added = 0;
        int skipped = 0;
        for (JsonNode it : items) {
            String title = it.path("title").asText("").trim();
            if (title.isEmpty()) {
                continue;
            }
            int year = it.path("year").asInt(0);
            String cover = it.path("coverUrl").asText(null);
            SyncResult r = upsert(title, year, cover);
            added += r.added();
            skipped += r.skipped();
        }
        log.info("omofuna 导入完成：新增 {}，跳过 {}", added, skipped);
        return new SyncResult(added, skipped);
    }

    /** 单条 upsert：title/original_title 任一命中库中已有 → 跳过；否则建媒体（original_title 留空）+ 异步封面。 */
    private SyncResult upsert(String title, int year, String cover) {
        Media existing = mediaMapper.selectByTitleOrOriginal(title);
        if (existing != null) {
            // 命中已有：若尚无封面且本次带 URL → 补 URL + 触发补下（修复异步下载中断导致的封面缺失）
            if ((existing.getCoverPath() == null || existing.getCoverPath().isBlank())
                    && cover != null && !cover.isBlank()) {
                existing.setCoverUrl(cover);
                mediaMapper.updateById(existing);
                coverService.downloadAsync(existing.getId(), cover);
            }
            return new SyncResult(0, 1);
        }
        Media a = new Media();
        a.setTitle(title);          // 中文标题
        a.setOriginalTitle(null);   // omofuna 无日文原名，留空（与 AniList 日文牌并存，靠 merge 手动合）
        a.setYear(year);
        a.setCoverUrl(cover);
        a.setMediaFormat("VIDEO");
        a.setStatus("WANT");
        a.setConfirmed(1);
        a.setSource("OMOFUNA");
        a.setCreatedAt(System.currentTimeMillis());
        mediaMapper.insert(a);
        if (cover != null && !cover.isBlank()) {
            coverService.downloadAsync(a.getId(), cover);
        }
        return new SyncResult(1, 0);
    }
}
