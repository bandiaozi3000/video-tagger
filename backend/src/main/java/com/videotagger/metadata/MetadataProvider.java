package com.videotagger.metadata;

import java.util.List;

public interface MetadataProvider {
    String id();
    ProviderCapabilities capabilities();
    List<MetadataRecord> search(String keyword, int limit) throws MetadataProviderException;
    List<MetadataRecord> discover(Integer year, String season, int limit) throws MetadataProviderException;

    /**
     * 按**任意开播日期区间**发现作品（`from` 含、`to` 不含，`YYYY-MM-DD`）。
     *
     * 新同步流程用：年/季/月多选规划出的每段区间都要逐段查（同一请求多段会 AND 成 0 条）。
     */
    List<MetadataRecord> discoverRange(String from, String to, int limit) throws MetadataProviderException;

    MetadataRecord get(String externalId) throws MetadataProviderException;
}
