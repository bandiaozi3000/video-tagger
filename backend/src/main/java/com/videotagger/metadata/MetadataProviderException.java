package com.videotagger.metadata;

public class MetadataProviderException extends RuntimeException {
    private final int status;

    public MetadataProviderException(String message, int status) {
        super(message);
        this.status = status;
    }

    public MetadataProviderException(String message, Throwable cause) {
        super(message, cause);
        this.status = 502;
    }

    public int status() {
        return status;
    }
}
