package com.videotagger.videosource.torrent;

import java.util.List;

/** BT 下载引擎最小契约（v0.25 D5）：Fake 引擎与 qB 引擎共用，自动化测试不真连网。 */
public interface TorrentClient {

    record DownloadedFile(String name, long size, boolean complete) {
        boolean isSubtitle() {
            String lower = name.toLowerCase();
            return lower.endsWith(".ass") || lower.endsWith(".ssa")
                    || lower.endsWith(".srt") || lower.endsWith(".vtt") || lower.endsWith(".sub");
        }
    }

    /** 添加下载（磁力链或 http(s) .torrent）到指定目录，返回任务令牌（qB hash / Fake 自造 id）。 */
    String add(String magnetOrTorrentUrl, String savePath);

    /** 暂停添加（v2 选择性下载第一步：不下载文件，只等元数据/文件清单）。 */
    String addPaused(String magnetOrTorrentUrl, String savePath);

    /** 只下载 keep 索引的文件并续传（v2 选择性下载第二步）。索引对齐 fileListing 顺序。 */
    void selectAndStart(String token, java.util.Collection<Integer> keep);

    /** 轮询直到下载完成（全部文件 progress=1）；超时抛 IllegalStateException（DOWNLOAD_TIMEOUT）。 */
    List<DownloadedFile> awaitComplete(String token, java.time.Duration timeout) throws InterruptedException;

    /** 拉取任务当前文件清单（v2 选择性下载：元数据就绪后即可列出，未下载完成也返回）。 */
    List<DownloadedFile> fileListing(String token);

    /** 移除任务；deleteFiles=true 连文件一起删。 */
    void remove(String token, boolean deleteFiles);

    static boolean isTorrentLocator(String locator) {
        if (locator == null) {
            return false;
        }
        String lower = locator.toLowerCase();
        return lower.startsWith("magnet:")
                || lower.startsWith("http://") && lower.endsWith(".torrent")
                || lower.startsWith("https://") && lower.endsWith(".torrent");
    }

    /** 从已完成清单中挑主视频文件：最大体积的非字幕媒体文件。 */
    static DownloadedFile pickVideo(List<DownloadedFile> files) {
        DownloadedFile best = null;
        for (DownloadedFile file : files) {
            if (file.isSubtitle() || !file.complete()) {
                continue;
            }
            String lower = file.name().toLowerCase();
            boolean video = lower.endsWith(".mkv") || lower.endsWith(".mp4") || lower.endsWith(".webm")
                    || lower.endsWith(".mov") || lower.endsWith(".avi") || lower.endsWith(".flv")
                    || lower.endsWith(".ts") || lower.endsWith(".m2ts") || lower.endsWith(".wmv");
            if (!video) {
                continue;
            }
            if (best == null || file.size() > best.size()) {
                best = file;
            }
        }
        return best;
    }

    static String mimeOf(String fileName) {
        String lower = fileName == null ? "" : fileName.toLowerCase();
        if (lower.endsWith(".mkv")) {
            return "video/x-matroska";
        }
        if (lower.endsWith(".webm")) {
            return "video/webm";
        }
        if (lower.endsWith(".mov")) {
            return "video/quicktime";
        }
        if (lower.endsWith(".avi")) {
            return "video/x-msvideo";
        }
        return "video/mp4";
    }

    static boolean isVideoName(String name) {
        String lower = name == null ? "" : name.toLowerCase();
        return lower.endsWith(".mkv") || lower.endsWith(".mp4") || lower.endsWith(".webm")
                || lower.endsWith(".mov") || lower.endsWith(".avi") || lower.endsWith(".flv")
                || lower.endsWith(".ts") || lower.endsWith(".m2ts") || lower.endsWith(".wmv");
    }

    /** v2 选择性下载：从包内文件名里挑“第 episode 集”的视频文件索引（忽略特典/OVA/菜单等）。
     *  匹配：解析集号命中，或显式 EP/E/第 N 标记。无命中返回空表（调用方报错引导）。 */
    /** 判定是否为“正片”视频文件（非 OVA/特典/OPED/预告/菜单/剧场 等附属）：
     *  忽略种子根目录第一层（整包名常含 OVA/特典字样，不能误伤全部），只检查其后路径与文件名。 */
    static boolean isMainEpisodeName(String fullName) {
        if (fullName == null || !isVideoName(fullName)) {
            return false;
        }
        String[] parts = fullName.replace('\\', '/').split("/");
        StringBuilder rest = new StringBuilder();
        for (int i = Math.min(1, parts.length - 1); i < parts.length; i++) {
            if (rest.length() > 0) rest.append('/');
            rest.append(parts[i]);
        }
        String lower = rest.toString().toLowerCase();
        // 直接子串判定附属（根目录第一层已忽略）：宁可少匹配也不把 OVA 当正片
        String[] specials = {"ova", "ovas", "特典", "番外", "剧场", "映画", "最终章", "预告", "预告片",
                "menu", "ncop", "nced", "tokuten", "特别篇", "preview"};
        for (String t : specials) {
            if (lower.contains(t)) {
                return false;
            }
        }
        // 短标记 op/ed/pv/sp 只在两侧非字母数字时算（避免 Dubbed/Subbed 等误伤）
        if (hasWrappedTag(lower, "op") || hasWrappedTag(lower, "ed")
                || hasWrappedTag(lower, "pv") || hasWrappedTag(lower, "sp")) {
            return false;
        }
        return true;
    }

    private static boolean hasWrappedTag(String lower, String tag) {
        int from = 0;
        while (true) {
            int at = lower.indexOf(tag, from);
            if (at < 0) {
                return false;
            }
            char before = at > 0 ? lower.charAt(at - 1) : ' ';
            int end = at + tag.length();
            char after = end < lower.length() ? lower.charAt(end) : ' ';
            boolean bOk = !Character.isLetterOrDigit(before);
            boolean aOk = !Character.isLetterOrDigit(after);
            if (bOk && aOk) {
                return true;
            }
            from = end;
        }
    }

    /** v2 选择性下载：从包内文件名里挑“第 episode 集”的正片视频文件索引。
     *  只认正片（OVA/特典等附属不参与集号匹配，避免 第1集 与 OVA第1 混淆）。 */
    static java.util.List<Integer> selectiveIndices(java.util.List<String> names, int episode) {
        java.util.List<Integer> result = new java.util.ArrayList<>();
        if (names == null || episode < 1) {
            return result;
        }
        java.util.regex.Pattern explicit = java.util.regex.Pattern.compile(
                "(?i)(?:^|[\\s._\\-\\[\\]【】()])(?:S\\d+[Ee]|EP|E|第)\\s*0*" + episode + "(?![0-9])");
        for (int i = 0; i < names.size(); i++) {
            String full = names.get(i);
            if (!isMainEpisodeName(full)) {
                continue;
            }
            String base = full.substring(Math.max(full.lastIndexOf('/'), full.lastIndexOf('\\')) + 1);
            TorrentTitleInfo info = TorrentTitleParser.parse(base);
            if (info.episodes().contains(episode)) {
                result.add(i);
                continue;
            }
            if (explicit.matcher(base).find()) {
                result.add(i);
            }
        }
        return result;
    }

    static String extensionOf(String fileName) {
        if (fileName == null) {
            return "mkv";
        }
        String value = fileName.replace('\\', '/');
        int i = value.lastIndexOf('/');
        if (i >= 0) {
            value = value.substring(i + 1);
        }
        i = value.lastIndexOf('.');
        if (i < 0) {
            return "mkv";
        }
        String ext = value.substring(i + 1).replaceAll("[^A-Za-z0-9]", "").toLowerCase();
        return ext.isBlank() || ext.length() > 8 ? "mkv" : ext;
    }
}
