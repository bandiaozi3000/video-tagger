package com.videotagger.videosource;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class VideoSourceText {
    private static final Pattern[] EPISODE_PATTERNS = {
            Pattern.compile("(?:第\\s*)?(\\d{1,4})(?:\\s*[话話集])", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(?:^|[\\s._\\-\\[])E(?:P)?\\s*[._\\-]?\\s*(\\d{1,4})(?:v\\d+)?(?:$|[\\s._\\-\\]])", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\[(\\d{1,3})(?:v\\d+)?(?:END)?]", Pattern.CASE_INSENSITIVE),
            Pattern.compile("^\\s*(\\d{1,4})(?:\\s*[-–—:：].*)?$", Pattern.CASE_INSENSITIVE)
    };
    private static final Pattern RELEASE_GROUP = Pattern.compile("^\\s*\\[([^]]{1,80})]\\s*");

    private VideoSourceText() {
    }

    static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest, 0, 12);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String encodeIdentity(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    static String decodeIdentity(String value) {
        try {
            return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new VideoSourceProviderException("identity", "INVALID_IDENTITY", "Provider identity is invalid", false, e);
        }
    }

    static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    static Integer episodeNumber(String title) {
        if (title == null) return null;
        for (Pattern pattern : EPISODE_PATTERNS) {
            Matcher matcher = pattern.matcher(title);
            if (matcher.find()) {
                int number = Integer.parseInt(matcher.group(1));
                if (number > 0 && number < 2000) return number;
            }
        }
        return null;
    }

    static String releaseGroup(String title) {
        if (title == null) return "未分组";
        Matcher matcher = RELEASE_GROUP.matcher(title);
        return matcher.find() ? matcher.group(1).trim() : "未分组";
    }

    static String extension(String locator) {
        String path = java.net.URI.create(locator).getPath().toLowerCase(Locale.ROOT);
        int dot = path.lastIndexOf('.');
        return dot < 0 ? "" : path.substring(dot);
    }
}
