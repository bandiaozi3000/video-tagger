package com.videotagger.service;

import com.videotagger.entity.Media;
import com.videotagger.entity.TitleMapping;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.TitleMappingMapper;
import com.videotagger.util.TitleParser;
import org.springframework.stereotype.Service;

/** 标题映射：打标签识别标题 → 已归入媒体；映射后下次同标题自动归位。
 *  映射键 = TitleParser 解析出的媒体名（与打标归属链路同一口径），因此
 *  save/get/delete 的对外入口均「按原始标题解析后定位键」，ClipService 内部已解析则直用精确键。 */
@Service
public class TitleMappingService {

    private final TitleMappingMapper mapper;
    private final MediaMapper mediaMapper;

    public TitleMappingService(TitleMappingMapper mapper, MediaMapper mediaMapper) {
        this.mapper = mapper;
        this.mediaMapper = mediaMapper;
    }

    /** 查映射（精确键，ClipService 已解析出 mediaTitle 时用）：识别标题 → 媒体 id；无返回 null。 */
    public Long getByTitle(String title) {
        if (title == null || title.isBlank()) {
            return null;
        }
        TitleMapping m = mapper.selectById(title);
        return m == null ? null : m.getMediaId();
    }

    /** 按原始标题解析后查映射，返回视图（含媒体标题，供扩展浮层「已记住归入」提示）；无映射时 mediaId=null。 */
    public TitleMappingView resolve(String rawTitle) {
        if (rawTitle == null || rawTitle.isBlank()) {
            return new TitleMappingView(null, null, null);
        }
        String parsed = TitleParser.parse(rawTitle).mediaTitle();
        TitleMapping m = mapper.selectById(parsed);
        if (m == null) {
            return new TitleMappingView(parsed, null, null);
        }
        Media media = mediaMapper.selectById(m.getMediaId());
        String mediaTitle = (media != null && media.getDeletedAt() == null) ? media.getTitle() : null;
        return new TitleMappingView(parsed, m.getMediaId(), mediaTitle);
    }

    /** 保存映射（幂等 upsert），键 = 原始标题解析出的媒体名。 */
    public void save(String title, Long mediaId) {
        if (title == null || title.isBlank() || mediaId == null) {
            return;
        }
        TitleMapping existing = mapper.selectById(title);
        long now = System.currentTimeMillis();
        if (existing == null) {
            TitleMapping m = new TitleMapping();
            m.setTitle(title);
            m.setMediaId(mediaId);
            m.setCreatedAt(now);
            mapper.insert(m);
        } else {
            existing.setMediaId(mediaId);
            mapper.updateById(existing);
        }
    }

    /** 按原始标题解析后保存映射；媒体不存在（含已彻底删除）返回 null 不落映射。 */
    public String saveForRawTitle(String rawTitle, Long mediaId) {
        if (rawTitle == null || rawTitle.isBlank() || mediaId == null) {
            return null;
        }
        Media media = mediaMapper.selectById(mediaId);
        if (media == null) {
            return null;
        }
        String parsed = TitleParser.parse(rawTitle).mediaTitle();
        save(parsed, mediaId);
        return parsed;
    }

    /** 删除映射（精确键，幂等）。 */
    public void deleteByTitle(String title) {
        if (title == null || title.isBlank()) {
            return;
        }
        mapper.deleteById(title);
    }

    /** 按原始标题解析后删除映射（幂等）。 */
    public void deleteForRawTitle(String rawTitle) {
        if (rawTitle == null || rawTitle.isBlank()) {
            return;
        }
        deleteByTitle(TitleParser.parse(rawTitle).mediaTitle());
    }

    /** 映射视图：识别标题 + 归入媒体 id + 媒体标题（媒体在回收站/已删时为 null）。 */
    public record TitleMappingView(String parsedTitle, Long mediaId, String mediaTitle) {
    }
}
