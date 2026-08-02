package com.videotagger.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

class VideoFingerprintTest {

    @Test
    void stripsTrackingButKeepsPParam() {
        assertEquals("https://www.bilibili.com/video/BV1?p=2",
                VideoFingerprint.normalize(
                        "https://www.bilibili.com/video/BV1?p=2&spm_id_from=333.999&from=search&vd_source=abc"));
    }

    @Test
    void sortsQueryParamsForStability() {
        assertEquals("https://a.com/v?a=1&b=2",
                VideoFingerprint.normalize("https://a.com/v?b=2&a=1"));
    }

    @Test
    void stripsFragmentAndT() {
        assertEquals("https://a.com/v", VideoFingerprint.normalize("https://a.com/v?t=123s#at=45"));
    }

    @Test
    void sameVideoDifferentSourcesSameFingerprint() {
        String fp1 = VideoFingerprint.fingerprint("https://www.youtube.com/watch?v=abc&t=100s&si=x");
        String fp2 = VideoFingerprint.fingerprint("https://www.youtube.com/watch?v=abc&list=PL123&feature=share");
        assertEquals(fp1, fp2);
    }

    @Test
    void differentVideosDifferentFingerprints() {
        assertNotEquals(
                VideoFingerprint.fingerprint("https://a.com/v/1"),
                VideoFingerprint.fingerprint("https://a.com/v/2"));
    }
}
