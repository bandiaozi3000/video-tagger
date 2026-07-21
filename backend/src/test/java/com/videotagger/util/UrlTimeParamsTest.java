package com.videotagger.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UrlTimeParamsTest {

    @Test
    void youtubeAppendsTSeconds() {
        assertEquals("https://www.youtube.com/watch?v=abc&t=754s",
                UrlTimeParams.build("https://www.youtube.com/watch?v=abc", 754.5));
    }

    @Test
    void bilibiliAppendsTParam() {
        assertEquals("https://www.bilibili.com/video/BV1xx?t=754",
                UrlTimeParams.build("https://www.bilibili.com/video/BV1xx", 754.5));
    }

    @Test
    void bilibiliWithExistingQueryUsesAmpersand() {
        assertEquals("https://www.bilibili.com/video/BV1xx?p=2&t=754",
                UrlTimeParams.build("https://www.bilibili.com/video/BV1xx?p=2", 754.5));
    }

    @Test
    void otherSitesUnchanged() {
        assertEquals("https://v.example.com/watch/1",
                UrlTimeParams.build("https://v.example.com/watch/1", 754.5));
    }
}
