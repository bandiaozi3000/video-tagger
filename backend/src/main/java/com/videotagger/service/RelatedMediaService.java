package com.videotagger.service;

import com.videotagger.mapper.ExternalRelationMapper;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 同系列条目（跨媒体借片段的来源解析）。
 *
 * 设计规格：`docs/superpowers/specs/2026-09-20-cross-media-clip-source-design.md`。
 *
 * 数据来自 **`external_relation` 表**（不是解析 `relations_json`）：
 * 6917《草莓棉花糖》的关联里，两条「番外篇」能反查到本地 media#6672 / #6648。
 *
 * **白名单只留视频类关系**：广播剧/角色歌/片头片尾曲/游戏/书籍/原声集这些不是"能借片段的东西"，
 * 列出来只会把面板刷满 —— 用户 2026-09-20 定稿时明确**去掉「其他」**这种 catch-all。
 */
@Service
public class RelatedMediaService {
    /** 视频类关系白名单（顺序 = 面板里的分组顺序）。加类型只改这里。 */
    public static final List<String> VIDEO_RELATION_TYPES = List.of(
            "主线故事", "前传", "续集", "番外篇", "剧场版", "角色出演", "同一世界观");

    private final ExternalRelationMapper relationMapper;

    public RelatedMediaService(ExternalRelationMapper relationMapper) {
        this.relationMapper = relationMapper;
    }

    /** 该媒体的同系列候选人（本地有、有片段、非自身，按白名单顺序 + 片段数倒序）。 */
    public List<RelatedMedia> videoRelated(long mediaId) {
        List<LinkedRelation> relations = relationMapper.listLinkedMedia(mediaId);
        Map<Long, RelatedMedia> picked = new LinkedHashMap<>();
        List<RelatedMedia> ordered = new ArrayList<>();
        for (LinkedRelation relation : relations) {
            RelatedMedia candidate = toCandidate(relation);
            if (candidate == null) continue;
            if (candidate.mediaId() == mediaId) continue;                 // 关联到自己（自引用）
            if (candidate.clipCount() <= 0) continue;                     // 没有片段 → 借不到，不列
            if (picked.putIfAbsent(candidate.mediaId(), candidate) != null) continue;   // 同一条目多条关联
            ordered.add(candidate);
        }
        ordered.sort((a, b) -> {
            int byType = Integer.compare(VIDEO_RELATION_TYPES.indexOf(a.relationType()), VIDEO_RELATION_TYPES.indexOf(b.relationType()));
            if (byType != 0) return byType;
            if (a.clipCount() != b.clipCount()) return Long.compare(b.clipCount(), a.clipCount());
            return String.valueOf(a.title()).compareTo(String.valueOf(b.title()));
        });
        return ordered;
    }

    /** 一行关联 → 候选人；不在白名单 / 本地没连媒体 → null。 */
    private RelatedMedia toCandidate(LinkedRelation relation) {
        if (relation == null || relation.relationType() == null) return null;
        String type = relation.relationType().trim();
        if (!VIDEO_RELATION_TYPES.contains(type)) return null;
        if (relation.linkedMediaId() == null) return null;
        return new RelatedMedia(relation.linkedMediaId(), relation.title(), relation.linkedMediaYear(), type,
                relation.linkedClipCount() == null ? 0 : relation.linkedClipCount());
    }
}
