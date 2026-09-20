package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.ExternalRelation;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.videotagger.service.LinkedRelation;

import java.util.List;

@Mapper
public interface ExternalRelationMapper extends BaseMapper<ExternalRelation> {
    @Select("SELECT * FROM external_relation WHERE external_work_id = #{workId} ORDER BY id")
    List<ExternalRelation> listByWork(@Param("workId") long workId);

    /**
     * 该媒体的「关联条目 → 本地媒体」解析（跨媒体借片段的来源）。
     *
     * 关联存在 （不是解析 relations_json）；通过 related_external_id 反查
     * 本地已连的 external_work → media。片段数在 SQL 里算好，服务层只做白名单/去重/排序。
     */
    @Select("SELECT r.relation_type AS relationType, COALESCE(m.title, r.title) AS title, "
            + "m.id AS linkedMediaId, m.year AS linkedMediaYear, "
            + "(SELECT COUNT(*) FROM clips c JOIN episode e ON e.id = c.episode_id WHERE e.media_id = m.id) AS linkedClipCount "
            + "FROM external_work w "
            + "JOIN external_relation r ON r.external_work_id = w.id "
            + "JOIN external_work w2 ON w2.external_id = r.related_external_id AND w2.media_id IS NOT NULL "
            + "AND (r.provider IS NULL OR w2.provider = r.provider) "
            + "JOIN media m ON m.id = w2.media_id AND m.deleted_at IS NULL "
            + "WHERE w.media_id = #{mediaId} ORDER BY r.id")
    List<LinkedRelation> listLinkedMedia(@Param("mediaId") long mediaId);

    @org.apache.ibatis.annotations.Delete("DELETE FROM external_relation WHERE external_work_id = #{workId}")
    void deleteByWork(@Param("workId") long workId);

}
