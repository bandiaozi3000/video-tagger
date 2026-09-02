package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("external_work")
public class ExternalWork {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String provider;
    private String externalId;
    private Long mediaId;
    private Long mediaEntryId;
    private String canonicalTitle;
    private String nativeTitle;
    private String romajiTitle;
    private String englishTitle;
    private String aliasesJson;
    private String description;
    private String coverUrl;
    private String genresJson;
    private String format;
    private Integer year;
    private String season;
    private String airDate;
    private String endDate;
    private Integer episodeCount;
    private String relationsJson;
    private String rawJson;
    private String payloadHash;
    private String syncState;
    private Long lastFetchedAt;
    private Long lastSuccessAt;
    private String lastError;
    private Long createdAt;
    private Long updatedAt;
}
