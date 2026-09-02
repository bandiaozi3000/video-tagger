package com.videotagger.videosource;

public class VideoSourceProviderException extends RuntimeException {
    private final String providerId;
    private final String reasonCode;
    private final boolean retryable;

    public VideoSourceProviderException(String providerId, String reasonCode, String message, boolean retryable) {
        super(message);
        this.providerId = providerId;
        this.reasonCode = reasonCode;
        this.retryable = retryable;
    }

    public VideoSourceProviderException(String providerId, String reasonCode, String message,
                                        boolean retryable, Throwable cause) {
        super(message, cause);
        this.providerId = providerId;
        this.reasonCode = reasonCode;
        this.retryable = retryable;
    }

    public String providerId() {
        return providerId;
    }

    public String reasonCode() {
        return reasonCode;
    }

    public boolean retryable() {
        return retryable;
    }
}
