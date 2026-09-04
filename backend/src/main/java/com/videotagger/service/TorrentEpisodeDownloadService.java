package com.videotagger.service;

import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.videosource.torrent.TorrentClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.List;

/** BT 下载→登记（v0.25 G5）：调 qB 引擎（无引擎时报 TORRENT_ENGINE_REQUIRED），完成后挑主视频文件
 *  移到标准资产路径并做与 HTTP 下载同款的登记（指纹/大小/mime/AVAILABLE）。
 *  v1 只处理单集种子；合集包在 v2 拆集，这里若清单含多视频仅取最大一个并告警。 */
@Service
public class TorrentEpisodeDownloadService {

    private static final Duration DOWNLOAD_TIMEOUT = Duration.ofMinutes(45);

    private final VideoAssetMapper assetMapper;
    private final Path root;
    private final ObjectProvider<TorrentClient> engineProvider;

    @Autowired
    public TorrentEpisodeDownloadService(VideoAssetMapper assetMapper,
                                         ObjectProvider<TorrentClient> engineProvider,
                                         @Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String root) {
        this(assetMapper, engineProvider, Path.of(root));
    }

    TorrentEpisodeDownloadService(VideoAssetMapper assetMapper,
                                  ObjectProvider<TorrentClient> engineProvider, Path root) {
        this.assetMapper = assetMapper;
        this.engineProvider = engineProvider;
        this.root = root.toAbsolutePath().normalize();
    }

    public VideoDownloadService.DownloadResult download(long assetId, long mediaId, long entryId,
                                                        long episodeId, String locator, long maxBytes,
                                                        Integer targetEpisode) throws Exception {
        TorrentClient engine = engineProvider.getIfAvailable();
        if (engine == null) {
            throw new IllegalStateException("TORRENT_ENGINE_REQUIRED: Torrent download engine is not installed");
        }
        VideoAsset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new IllegalArgumentException("Asset not found");
        }
        Files.createDirectories(root);
        if (Files.getFileStore(root).getUsableSpace() < Math.max(1, maxBytes)) {
            throw new IllegalStateException("Insufficient disk space");
        }
        Path inbox = root.resolve(".torrent-inbox").resolve(String.valueOf(assetId));
        Files.createDirectories(inbox);
        String token;
        if (targetEpisode != null && targetEpisode > 0) {
            // v2 选择性下载：暂停添加 → 等包内文件清单 → 只挑第 targetEpisode 集视频文件 → 续传
            token = engine.addPaused(locator, inbox.toString());
            java.util.List<TorrentClient.DownloadedFile> listed = awaitFileList(engine, token, inbox);
            java.util.List<String> names = listed.stream().map(TorrentClient.DownloadedFile::name).toList();
            java.util.List<Integer> keep = TorrentClient.selectiveIndices(names, targetEpisode);
            if (keep.isEmpty()) {
                throw new IllegalStateException("TORRENT_NO_MATCH: 合集包内找不到第 " + targetEpisode
                        + " 集的文件（命名无法识别：" + names + "）");
            }
            engine.selectAndStart(token, keep);
        } else {
            token = engine.add(locator, inbox.toString());
        }
        try {
            List<TorrentClient.DownloadedFile> files = engine.awaitComplete(token, DOWNLOAD_TIMEOUT);
            TorrentClient.DownloadedFile video = TorrentClient.pickVideo(files);
            if (video == null) {
                throw new IllegalStateException("TORRENT_NO_VIDEO: no video file found in torrent");
            }
            Path source = inbox.resolve(video.name().replace('\\', '/'));
            if (!Files.isRegularFile(source)) {
                throw new IllegalStateException("TORRENT_FILE_MISSING: " + video.name());
            }
            long size = Files.size(source);
            if (size > maxBytes) {
                throw new IllegalStateException("Response exceeds size limit");
            }
            String ext = TorrentClient.extensionOf(video.name());
            Path target = VideoAssetPathService.assetPath(root, mediaId, entryId, episodeId, assetId, ext);
            Files.createDirectories(target.getParent());
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            String fingerprint = sha256(target);
            asset.setStoragePath(root.relativize(target).toString().replace('\\', '/'));
            asset.setFileSize(size);
            asset.setFingerprint(fingerprint);
            asset.setMimeType(TorrentClient.mimeOf(video.name()));
            asset.setAvailabilityState("AVAILABLE");
            asset.setUpdatedAt(System.currentTimeMillis());
            asset.setLastVerifiedAt(System.currentTimeMillis());
            assetMapper.updateById(asset);
            return new VideoDownloadService.DownloadResult(assetId, target, size, fingerprint);
        } finally {
            try {
                engine.remove(token, false);
            } catch (Exception ignored) {
            }
            deleteRecursively(inbox);
        }
    }

    private static java.util.List<TorrentClient.DownloadedFile> awaitFileList(
            TorrentClient engine, String token, Path inbox) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 240_000;
        while (System.currentTimeMillis() < deadline) {
            java.util.List<TorrentClient.DownloadedFile> listed = engine.fileListing(token);
            if (listed != null && !listed.isEmpty()) {
                return listed;
            }
            Thread.sleep(1500);
        }
        throw new IllegalStateException("TORRENT_META_TIMEOUT: 等待种子文件清单超时");
    }

    private static String sha256(Path file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = Files.newInputStream(file)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) {
                digest.update(buf, 0, n);
            }
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : digest.digest()) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static void deleteRecursively(Path dir) {
        if (dir == null || !Files.isDirectory(dir)) {
            return;
        }
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
            for (Path entry : stream) {
                if (Files.isDirectory(entry)) {
                    deleteRecursively(entry);
                } else {
                    try {
                        Files.deleteIfExists(entry);
                    } catch (IOException ignored) {
                    }
                }
            }
            Files.deleteIfExists(dir);
        } catch (IOException ignored) {
        }
    }
}
