package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.MediaSubcategory;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface MediaSubcategoryMapper extends BaseMapper<MediaSubcategory> {

    /** 某格式下的子分类，按 sort 排序。 */
    @Select("SELECT * FROM media_subcategory WHERE format_id = #{formatId} ORDER BY sort, id")
    List<MediaSubcategory> listByFormat(@Param("formatId") long formatId);
}
