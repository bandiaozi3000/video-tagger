package com.videotagger.videosource;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class VideoSourceTitleMatcher {
    private static final String MARKERS = "(?i)(剧场版|电影版|movie|the movie|tv版|テレビアニメ|动画版|動畫版)";
    private static final String DERIVATIVE_MARKERS = "(?i)(ova|oad|剧场版|电影版|最终章|特典|总集篇|总集编|番外篇|特别篇|special|movie)";

    private VideoSourceTitleMatcher() {
    }

    public static String searchKeyword(String value, boolean removeSpecial, boolean useOnlyFirstWord) {
        if (value == null) return "";
        String result = Normalizer.normalize(value, Normalizer.Form.NFKC).trim();
        if (removeSpecial) {
            result = result.replaceAll(MARKERS, " ")
                    .replaceAll("[\\p{P}\\p{S}]+", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
        }
        if (useOnlyFirstWord && result.contains(" ")) result = result.substring(0, result.indexOf(' '));
        return result.isBlank() ? value.trim() : result;
    }

    public static int score(String expected, String actual) {
        String left = normalize(expected);
        String right = normalize(actual);
        if (left.isBlank() || right.isBlank()) return 0;
        if (left.equals(right)) return 100;
        if (left.length() >= 2 && right.length() >= 2 && (left.contains(right) || right.contains(left))) return 96;
        int distance = levenshtein(left, right);
        return Math.max(0, 100 - (distance * 100 / Math.max(left.length(), right.length())));
    }

    public static boolean matches(String expected, String actual) {
        return score(expected, actual) >= 72;
    }

    public static MatchResult match(VideoSourceDiscoveryQuery query, VideoSourcePackage sourcePackage,
                                    VideoSourceItem item) {
        if (externalIdMatches(query.externalIds(), sourcePackage.sanitizedSnapshot(), item.sanitizedSnapshot())) {
            return new MatchResult(true, "EXACT_EXTERNAL_ID", 120, "命中作品外部 ID");
        }
        if (externalIdMatches(query.episodeExternalIds(), sourcePackage.sanitizedSnapshot(), item.sanitizedSnapshot())) {
            return new MatchResult(true, "EXACT_EXTERNAL_ID", 125, "命中集外部 ID");
        }

        if (isUnrequestedDerivative(query.titles(), sourcePackage.title())
                || isUnrequestedDerivative(query.titles(), String.valueOf(sourcePackage.sanitizedSnapshot().get("detailTitle")))) {
            return new MatchResult(false, "CONFLICT", 0, "作品属于未请求的 OVA/剧场版/最终章等衍生条目");
        }

        int packageTitleScore = query.titles().stream()
                .mapToInt(title -> Math.max(score(title, sourcePackage.title()),
                        snapshotTitleScore(title, sourcePackage.sanitizedSnapshot())))
                .max().orElse(0);
        if (packageTitleScore < 80) {
            return new MatchResult(false, "CONFLICT", packageTitleScore, "作品标题不匹配");
        }

        Integer expectedNumber = query.episodeSort() != null ? query.episodeSort() : query.episodeEp();
        Integer candidateNumber = item.episodeNumber();
        if (expectedNumber != null && candidateNumber != null) {
            if (expectedNumber.equals(candidateNumber)
                    || (item.episodeEndNumber() != null && expectedNumber >= candidateNumber
                    && expectedNumber <= item.episodeEndNumber())) {
                return new MatchResult(true, packageTitleScore >= 96 ? "EXACT_TITLE_EPISODE" : "FUZZY_TITLE_EPISODE",
                        packageTitleScore + 20, "作品标题与集号匹配");
            }
            return new MatchResult(false, "CONFLICT", packageTitleScore, "集号冲突");
        }

        int episodeTitleScore = query.episodeTitles().stream()
                .mapToInt(title -> score(title, item.title())).max().orElse(0);
        if (expectedNumber == null && episodeTitleScore >= 90) {
            return new MatchResult(true, packageTitleScore >= 96 ? "EXACT_TITLE_EPISODE" : "FUZZY_TITLE_EPISODE",
                    packageTitleScore + episodeTitleScore / 5, "作品标题与集标题匹配");
        }
        if (candidateNumber == null && expectedNumber != null && episodeTitleScore >= 90) {
            return new MatchResult(true, "FUZZY_TITLE_EPISODE", packageTitleScore + episodeTitleScore / 5,
                    "作品标题匹配，集号缺失但集标题吻合");
        }
        if (expectedNumber == null && candidateNumber == null) {
            return new MatchResult(true, "EPISODE_ONLY", packageTitleScore, "仅按作品标题匹配，未发现集号");
        }
        return new MatchResult(false, "CONFLICT", packageTitleScore, "缺少可验证的集号或集标题");
    }

    public record MatchResult(boolean accepted, String level, int score, String reason) {}

    private static int snapshotTitleScore(String expected, Map<String, Object> snapshot) {
        int best = 0;
        for (String key : List.of("title", "detailTitle", "subjectTitle", "name")) {
            Object value = snapshot.get(key);
            if (value != null) best = Math.max(best, score(expected, String.valueOf(value)));
        }
        return best;
    }

    private static boolean isUnrequestedDerivative(List<String> expectedTitles, String candidate) {
        if (candidate == null || candidate.isBlank() || !candidate.matches(".*" + DERIVATIVE_MARKERS + ".*")) {
            return false;
        }
        return expectedTitles.stream().noneMatch(title -> title != null && title.matches(".*" + DERIVATIVE_MARKERS + ".*"));
    }

    private static boolean externalIdMatches(Map<String, String> expected, Map<String, Object> packageSnapshot,
                                             Map<String, Object> itemSnapshot) {
        if (expected == null || expected.isEmpty()) return false;
        for (Map.Entry<String, String> entry : expected.entrySet()) {
            if (entry.getValue() == null || entry.getValue().isBlank()) continue;
            if (snapshotContainsId(packageSnapshot, entry.getKey(), entry.getValue())
                    || snapshotContainsId(itemSnapshot, entry.getKey(), entry.getValue())) return true;
        }
        return false;
    }

    private static boolean snapshotContainsId(Map<String, Object> snapshot, String provider, String expected) {
        if (snapshot == null || snapshot.isEmpty()) return false;
        for (String key : List.of("externalId", "subjectId", "providerId", "providerEpisodeId", "episodeId")) {
            if (expected.equals(String.valueOf(snapshot.get(key)))) return true;
        }
        Object ids = snapshot.get("externalIds");
        if (ids instanceof Map<?, ?> map) {
            Object value = map.get(provider);
            if (expected.equals(String.valueOf(value))) return true;
        }
        return false;
    }

    private static String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT)
                .replaceAll(MARKERS, "")
                .replaceAll("[\\p{P}\\p{S}\\s]+", "")
                .trim();
    }

    private static int levenshtein(String left, String right) {
        int[] previous = new int[right.length() + 1];
        int[] current = new int[right.length() + 1];
        for (int index = 0; index <= right.length(); index++) previous[index] = index;
        for (int leftIndex = 1; leftIndex <= left.length(); leftIndex++) {
            current[0] = leftIndex;
            for (int rightIndex = 1; rightIndex <= right.length(); rightIndex++) {
                int cost = left.charAt(leftIndex - 1) == right.charAt(rightIndex - 1) ? 0 : 1;
                current[rightIndex] = Math.min(Math.min(
                        current[rightIndex - 1] + 1,
                        previous[rightIndex] + 1),
                        previous[rightIndex - 1] + cost);
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[right.length()];
    }
}
