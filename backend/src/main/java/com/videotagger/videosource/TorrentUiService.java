package com.videotagger.videosource;

import com.videotagger.videosource.torrent.QbittorrentTorrentEngine;
import com.videotagger.videosource.torrent.RankedCandidate;
import com.videotagger.videosource.torrent.SubtitleTierHeuristic;
import com.videotagger.videosource.torrent.TorrentCandidateRanker;
import com.videotagger.videosource.torrent.TorrentClient;
import com.videotagger.videosource.torrent.TorrentTitleInfo;
import com.videotagger.videosource.torrent.TorrentTitleParser;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** v0.25 UI 支撑：三家种子源候选聚合 + 级联排序（无字幕>字幕分离>硬烧，级内 清晰度→x264→体积）+
 *  BT 引擎在线灯。仅聚合 RSS 候选为“可挑”，真下载仍走 VideoSourceTaskExecutor torrent 分支。 */
@Service
public class TorrentUiService {

    private static final Set<String> TORRENT_SOURCE_IDS = Set.of("nyaa", "mikan", "dmhy");

    private final VideoSourceProviderRegistry registry;
    private final ObjectProvider<QbittorrentTorrentEngine> engineProvider;

    public TorrentUiService(VideoSourceProviderRegistry registry,
                            ObjectProvider<QbittorrentTorrentEngine> engineProvider) {
        this.registry = registry;
        this.engineProvider = engineProvider;
    }

    public record CandidateDto(String providerId, String providerName, String title, String group,
                               String tier, String tierBasis, String resolution, String codec,
                               boolean batch, Integer episodeNumber, List<Integer> episodes,
                               String locator, String pageUrl, Integer seeders) {
    }

    public record EngineStatus(boolean enabled, boolean online, String version) {
    }

    public record PackView(java.util.List<Integer> episodes) {
    }

    public record MeasureEntry(int index, double mbps) {
    }

    public List<CandidateDto> searchCandidates(String title, List<String> aliases, int limit) {
        // 关键词 = 手输标题 + 别名（Bangumi 外链别名/原文等）；每源逐个关键词搜并去重合并
        List<String> keywords = new java.util.ArrayList<>();
        if (title != null && !title.isBlank()) {
            keywords.add(title.trim());
        }
        if (aliases != null) {
            for (String alias : aliases) {
                if (alias != null && !alias.isBlank() && keywords.size() < 6) {
                    String a = alias.trim();
                    if (!keywords.contains(a)) {
                        keywords.add(a);
                    }
                }
            }
        }
        if (keywords.isEmpty()) {
            return List.of();
        }
        List<RankedCandidate> ranked = new ArrayList<>();
        Map<String, CandidateDto> byKey = new LinkedHashMap<>();
        for (VideoSourceProvider provider : registry.all()) {
            if (!TORRENT_SOURCE_IDS.contains(provider.id())) {
                continue;
            }
            String displayName = provider.capabilities().displayName();
            for (String keyword : keywords) {
                List<VideoSourcePackage> packages;
                try {
                    packages = provider.discover(new VideoSourceDiscoveryQuery(
                            0L, Map.of(), List.of(keyword), null, null, null, null, 0, 150));
                } catch (Exception e) {
                    continue; // 单源/单关键词失败不影响整体
                }
                for (VideoSourcePackage pkg : packages) {
                    for (VideoSourceItem item : pkg.items()) {
                        String key = provider.id() + "\u0000" + item.providerItemId();
                        if (byKey.containsKey(key)) {
                            continue; // 同源同条目跨关键词去重
                        }
                        String locator = resolveLocator(item);
                        TorrentTitleInfo info = TorrentTitleParser.parse(item.title());
                        SubtitleTierHeuristic.TierGuess guess = SubtitleTierHeuristic.guess(info);
                        int seeders = item.sanitizedSnapshot() == null ? 0
                                : (item.sanitizedSnapshot().get("seeders") instanceof Number n ? n.intValue() : 0);
                        byKey.put(key, new CandidateDto(provider.id(), displayName, item.title(), info.group(),
                                guess.tier().name(), guess.basis(), info.resolution(), info.codec(),
                                info.batch(), item.episodeNumber(), info.episodes(), locator, item.sourcePageUrl(), seeders));
                        ranked.add(RankedCandidate.fromTitle(provider.id(), item.providerItemId(), item.title(), -1));
                    }
                }
            }
        }
        ranked = TorrentCandidateRanker.rank(ranked);
        // 每家源保底前 6 条入选，避免某站刷屏把其他站挤出；其余按全局排序补到上限
        List<CandidateDto> result = new ArrayList<>();
        java.util.LinkedHashSet<String> taken = new java.util.LinkedHashSet<>();
        Map<String, Integer> perProviderFloor = new java.util.LinkedHashMap<>();
        for (RankedCandidate candidate : ranked) {
            String key = candidate.providerId() + "\u0000" + candidate.itemId();
            if (taken.contains(key)) {
                continue;
            }
            int floor = perProviderFloor.getOrDefault(candidate.providerId(), 0);
            if (floor < 6) {
                CandidateDto dto = byKey.get(key);
                if (dto != null) {
                    result.add(dto);
                    taken.add(key);
                    perProviderFloor.put(candidate.providerId(), floor + 1);
                }
                if (result.size() >= Math.max(1, limit)) {
                    break;
                }
            }
        }
        for (RankedCandidate candidate : ranked) {
            String key = candidate.providerId() + "\u0000" + candidate.itemId();
            if (taken.contains(key)) {
                continue;
            }
            CandidateDto dto = byKey.get(key);
            if (dto != null) {
                result.add(dto);
                taken.add(key);
                if (result.size() >= Math.max(1, limit)) {
                    break;
                }
            }
        }
        return result;
    }

    private static String resolveLocator(VideoSourceItem item) {
        Map<String, Object> snapshot = item.sanitizedSnapshot();
        if (snapshot == null) {
            return null;
        }
        Object infoHash = snapshot.get("infoHash");
        if (infoHash != null && !String.valueOf(infoHash).isBlank()) {
            return "magnet:?xt=urn:btih:" + String.valueOf(infoHash).trim();
        }
        Object torrentUrl = snapshot.get("torrentUrl");
        if (torrentUrl != null && !String.valueOf(torrentUrl).isBlank()) {
            return String.valueOf(torrentUrl).trim();
        }
        String page = item.sourcePageUrl();
        if (page != null && page.toLowerCase().endsWith(".torrent")) {
            return page;
        }
        return null;
    }

    /** 实测测速（每候选 ~7s 采样 qB 下行）：顺序测量，返回与入参同序的 MB/s（失败/离线为 0）。 */
    public List<MeasureEntry> measure(java.util.List<String> locators) throws Exception {
        QbittorrentTorrentEngine engine = engineProvider.getIfAvailable();
        if (engine == null) {
            throw new IllegalStateException("TORRENT_ENGINE_REQUIRED");
        }
        List<MeasureEntry> out = new ArrayList<>();
        if (locators == null) {
            return out;
        }
        int index = 0;
        for (String locator : locators) {
            if (locator == null || locator.isBlank()) {
                out.add(new MeasureEntry(index, 0));
                index++;
                continue;
            }
            java.nio.file.Path tmp = null;
            String token = null;
            try {
                tmp = java.nio.file.Files.createTempDirectory("vt-measure-");
                token = engine.add(locator, tmp.toString());
                Thread.sleep(4000);
                long a = engine.info(token).map(QbittorrentTorrentEngine.TorrentState::dlspeed).orElse(0L);
                Thread.sleep(3000);
                long b = engine.info(token).map(QbittorrentTorrentEngine.TorrentState::dlspeed).orElse(0L);
                double mbps = Math.max(a, b) / 125_000d; // bytes/s → Mbit/s
                out.add(new MeasureEntry(index, mbps));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                out.add(new MeasureEntry(index, 0));
            } catch (Exception e) {
                out.add(new MeasureEntry(index, 0));
            } finally {
                if (token != null) {
                    try {
                        engine.remove(token, true);
                    } catch (Exception ignored) {
                    }
                }
                if (tmp != null) {
                    deleteRecursively(tmp);
                }
            }
            index++;
        }
        return out;
    }

    public EngineStatus engineStatus() {
        QbittorrentTorrentEngine engine = engineProvider.getIfAvailable();
        if (engine == null) {
            return new EngineStatus(false, false, null);
        }
        return new EngineStatus(true, engine.isOnline(), engine.version().orElse(null));
    }

    /** v2：列合集包内“正片”集数（引擎暂停添加→文件清单→解析集号→清理）。单选集号用。 */
    public PackView packEpisodes(String locator) throws Exception {
        QbittorrentTorrentEngine engine = engineProvider.getIfAvailable();
        if (engine == null) {
            throw new IllegalStateException("TORRENT_ENGINE_REQUIRED");
        }
        java.nio.file.Path tmp = java.nio.file.Files.createTempDirectory("vt-pack-");
        String token = engine.addPaused(locator, tmp.toString());
        try {
            java.util.List<TorrentClient.DownloadedFile> listed = null;
            long deadline = System.currentTimeMillis() + 240_000;
            while (System.currentTimeMillis() < deadline) {
                listed = engine.fileListing(token);
                if (listed != null && !listed.isEmpty()) {
                    break;
                }
                Thread.sleep(1500);
            }
            if (listed == null || listed.isEmpty()) {
                throw new IllegalStateException("TORRENT_META_TIMEOUT: 等待包内文件清单超时");
            }
            java.util.TreeSet<Integer> episodes = new java.util.TreeSet<>();
            for (TorrentClient.DownloadedFile f : listed) {
                String name = f.name();
                if (!TorrentClient.isMainEpisodeName(name)) {
                    continue; // 只统计正片（OVA/特典等附属不参与集号，避免 OVA第1 与 第1集 混淆）
                }
                String base = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
                episodes.addAll(TorrentTitleParser.parse(base).episodes());
            }
            return new PackView(java.util.List.copyOf(episodes));
        } finally {
            try {
                engine.remove(token, true);
            } catch (Exception ignored) {
            }
            deleteRecursively(tmp);
        }
    }

    private static void deleteRecursively(java.nio.file.Path dir) {
        if (dir == null || !java.nio.file.Files.isDirectory(dir)) {
            return;
        }
        try (java.nio.file.DirectoryStream<java.nio.file.Path> stream = java.nio.file.Files.newDirectoryStream(dir)) {
            for (java.nio.file.Path entry : stream) {
                if (java.nio.file.Files.isDirectory(entry)) {
                    deleteRecursively(entry);
                } else {
                    try {
                        java.nio.file.Files.deleteIfExists(entry);
                    } catch (Exception ignored) {
                    }
                }
            }
            java.nio.file.Files.deleteIfExists(dir);
        } catch (Exception ignored) {
        }
    }
}
