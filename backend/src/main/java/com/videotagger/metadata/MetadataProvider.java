package com.videotagger.metadata;

import java.util.List;

public interface MetadataProvider {
    String id();
    ProviderCapabilities capabilities();
    List<MetadataRecord> search(String keyword, int limit) throws MetadataProviderException;
    List<MetadataRecord> discover(Integer year, String season, int limit) throws MetadataProviderException;
    MetadataRecord get(String externalId) throws MetadataProviderException;
}
