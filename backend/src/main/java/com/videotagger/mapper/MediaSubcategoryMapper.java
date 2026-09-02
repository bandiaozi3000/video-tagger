package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.MediaSubcategory;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MediaSubcategoryMapper extends BaseMapper<MediaSubcategory> {

    /** 某格式下的子分类树（全量 flat，含 parent_id），按 sort 排序。 */
    @Select("SELECT * FROM media_subcategory WHERE format_id = #{formatId} ORDER BY sort, id")
    List<MediaSubcategory> listByFormat(@Param("formatId") long formatId);

    /** 全量子分类（统计路径 label 构建用）。 */
    @Select("SELECT * FROM media_subcategory ORDER BY format_id, id")
    List<MediaSubcategory> listAll();
}
