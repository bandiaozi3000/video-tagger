package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Tag;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface TagMapper extends BaseMapper<Tag> {

    /** 无则插入（INSERT IGNORE 防并发冲突），用于"无则建有则关联"。 */
    @Insert("INSERT IGNORE INTO tag(name, created_at) VALUES(#{name}, #{createdAt})")
    void insertIgnore(@Param("name") String name, @Param("createdAt") long createdAt);

    @Select("SELECT * FROM tag WHERE name = #{name} LIMIT 1")
    Tag selectByName(@Param("name") String name);

    /** 标签词库补全（前缀模糊，按词条先后）。 */
    @Select("SELECT * FROM tag WHERE name LIKE CONCAT('%', #{prefix}, '%') ORDER BY id LIMIT #{limit}")
    List<Tag> searchByPrefix(@Param("prefix") String prefix, @Param("limit") int limit);
}
