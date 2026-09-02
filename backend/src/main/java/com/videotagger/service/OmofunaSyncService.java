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
 * 旧 Provider 代码保留但当前不开放入口；不再写 Media 的外部重复字段或下载远程封面。
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
            return new SyncResult(0, 1);
        }
        Media a = new Media();
        a.setTitle(title);
        a.setYear(year);
        a.setMediaFormat("VIDEO");
        a.setStatus("WANT");
        a.setConfirmed(1);
        a.setCreatedAt(System.currentTimeMillis());
        mediaMapper.insert(a);
        return new SyncResult(1, 0);
    }
}
