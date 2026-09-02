package com.videotagger.metadata;

import java.util.List;

public record MetadataSyncResult(int total, int added, int updated, int failed, List<String> failedExternalIds) { }
