package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Collection;
import com.videotagger.service.CollectionSummary;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface CollectionMapper extends BaseMapper<Collection> {

    @Select("SELECT c.id, c.name, COUNT(ac.anime_id) AS animeCount "
            + "FROM collection c LEFT JOIN anime_collection ac ON ac.collection_id = c.id "
            + "GROUP BY c.id ORDER BY c.id")
    List<CollectionSummary> listSummaries();
}
