package com.videotagger.service;

import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalRelation;
import com.videotagger.entity.ExternalWork;

import java.util.List;

public record ExternalMetadataDetail(ExternalWork work, List<ExternalWork> works,
                                     List<ExternalEpisode> episodes, List<ExternalRelation> relations) {
}