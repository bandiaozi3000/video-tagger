package com.videotagger.videosource;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VideoSourcePolicyTest {
    @Test void acceptsPublicHttpsLocator() { assertEquals("https", RemoteResourcePolicy.validateLocator("https://example.com/video.mp4", false).getScheme()); }
    @Test void rejectsCredentials() { var e=assertThrows(VideoSourceProviderException.class, () -> RemoteResourcePolicy.validateLocator("https://user:secret@example.com/a", false)); assertEquals("CREDENTIALS_IN_URL", e.reasonCode()); }
    @Test void rejectsLocalHost() { var e=assertThrows(VideoSourceProviderException.class, () -> RemoteResourcePolicy.validateLocator("http://localhost/a", false)); assertEquals("PRIVATE_HOST", e.reasonCode()); }
    @Test void rejectsUnsupportedProtocol() { var e=assertThrows(VideoSourceProviderException.class, () -> RemoteResourcePolicy.validateLocator("javascript:alert(1)", false)); assertEquals("UNSUPPORTED_PROTOCOL", e.reasonCode()); }
}