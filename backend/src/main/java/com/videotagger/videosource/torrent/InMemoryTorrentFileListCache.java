package com.videotagger.videosource.torrent;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** 精判文件清单缓存（内存实现，v0.25 D2）：TTL 7 天，避免反复连 swarm 握手。 */
public final class InMemoryTorrentFileListCache implements TorrentFileListCache {

    private static final Duration TTL = Duration.ofDays(7);

    private final Map<String, Entry> store = new LinkedHashMap<>();

    @Override
    public synchronized Optional<List<String>> fileNames(String providerItemId) {
        Entry entry = store.get(providerItemId);
        if (entry == null) {
            return Optional.empty();
        }
        if (System.currentTimeMillis() - entry.createdAt > TTL.toMillis()) {
            store.remove(providerItemId);
            return Optional.empty();
        }
        return Optional.of(entry.names);
    }

    @Override
    public synchronized void put(String providerItemId, List<String> fileNames) {
        store.put(providerItemId, new Entry(List.copyOf(fileNames), System.currentTimeMillis()));
    }

    private record Entry(List<String> names, long createdAt) {
    }

    List<String> keys() {
        return new ArrayList<>(store.keySet());
    }
}
