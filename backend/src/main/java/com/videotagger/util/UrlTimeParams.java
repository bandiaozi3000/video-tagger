package com.videotagger.util;

public final class UrlTimeParams {

    private UrlTimeParams() {
    }

    /** 为支持时间参数的站点拼接回看 URL；其余站点原样返回（由扩展兜底 seek） */
    public static String build(String url, double timestampSec) {
        long seconds = (long) timestampSec;
        if (url.contains("youtube.com/watch")) {
            return url + (url.contains("?") ? "&" : "?") + "t=" + seconds + "s";
        }
        if (url.contains("bilibili.com/video")) {
            return url + (url.contains("?") ? "&" : "?") + "t=" + seconds;
        }
        return url;
    }
}
