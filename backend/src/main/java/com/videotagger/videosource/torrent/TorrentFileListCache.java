package com.videotagger.videosource.torrent;

import java.util.List;
import java.util.Optional;

/** 种子文件清单缓存接口（v0.25 D2 精判用）：记录某候选的 swarm 文件清单结果，TTL 7 天避免重复握手。
 *  内存/落库实现随引擎阶段（G4）一起落。 */
public interface TorrentFileListCache {

    Optional<List<String>> fileNames(String providerItemId);

    void put(String providerItemId, List<String> fileNames);
}
