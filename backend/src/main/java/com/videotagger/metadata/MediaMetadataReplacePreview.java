package com.videotagger.metadata;

import com.videotagger.entity.ExternalWork;

import java.util.List;

public record MediaMetadataReplacePreview(ExternalWork currentWork, MetadataCandidate candidate,
                                          List<EpisodeProtection> episodes) {
    public record EpisodeProtection(Long episodeId, Integer episodeNo, String title, int clipCount,
                                    boolean localVideo, boolean userTitle, boolean note,
                                    int tagCount, boolean cover, boolean protectedItem) { }
}
