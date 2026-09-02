package com.videotagger.metadata;

public record ProviderCapabilities(String id, String name, boolean supportsKeyword,
                                    boolean supportsYear, boolean supportsSeason, boolean supportsExternalId) {
}
