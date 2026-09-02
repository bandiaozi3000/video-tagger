package com.videotagger.metadata;

import java.util.List;

public record MediaMetadataLinkRequest(String externalId, String mode,
                                       List<Long> deleteEpisodeIds, Boolean confirmProtected) {
    public MediaMetadataLinkRequest(String externalId, String mode) {
        this(externalId, mode, List.of(), false);
    }
}
