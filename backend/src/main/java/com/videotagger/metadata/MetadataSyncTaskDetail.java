package com.videotagger.metadata;

import com.videotagger.entity.MetadataSyncTask;
import com.videotagger.entity.MetadataSyncTaskItem;

import java.util.List;

public record MetadataSyncTaskDetail(MetadataSyncTask task, List<MetadataSyncTaskItem> items) { }