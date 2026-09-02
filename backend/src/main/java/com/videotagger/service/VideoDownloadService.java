package com.videotagger.service;

import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.videosource.RemoteResourcePolicy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Duration;

@Service
public class VideoDownloadService {
    private final VideoAssetMapper assetMapper;
    private final Path root;
    private final HttpClient client;
    private final boolean validateRemote;
    @Autowired
    public VideoDownloadService(VideoAssetMapper assetMapper, @Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String root){this(assetMapper,root,HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).connectTimeout(Duration.ofSeconds(15)).build(),true);}
    VideoDownloadService(VideoAssetMapper assetMapper,String root,HttpClient client,boolean validateRemote){this.assetMapper=assetMapper;this.root=Path.of(root).toAbsolutePath().normalize();this.client=client;this.validateRemote=validateRemote;}
    public record DownloadResult(long assetId, Path path, long bytes, String fingerprint) {}
    public DownloadResult download(long assetId, long mediaId, long entryId, long episodeId, String locator, long maxBytes) throws Exception {
        VideoAsset asset=assetMapper.selectById(assetId); if(asset==null)throw new IllegalArgumentException("Asset not found");
        URI uri=validateRemote?RemoteResourcePolicy.validateLocator(locator,false):URI.create(locator); Path target=VideoAssetPathService.assetPath(root,mediaId,entryId,episodeId,assetId,extension(uri.getPath())); Path temp=VideoAssetPathService.temporaryPath(target); Files.createDirectories(target.getParent());
        if(Files.getFileStore(target.getParent()).getUsableSpace() < Math.max(1, maxBytes)) throw new IllegalStateException("Insufficient disk space");
        HttpRequest request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(60)).header("Accept","video/*").GET().build(); HttpResponse<InputStream> response=client.send(request,HttpResponse.BodyHandlers.ofInputStream());
        if(response.statusCode()/100!=2) throw new IllegalStateException("Download failed with HTTP " + response.statusCode()); String type=response.headers().firstValue("content-type").orElse("").toLowerCase(); if(!type.isBlank()&&!type.startsWith("video/"))throw new IllegalStateException("Response is not a video");
        long declared=response.headers().firstValueAsLong("content-length").orElse(-1); if(declared>maxBytes)throw new IllegalStateException("Response exceeds size limit"); long bytes=0; MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(InputStream in=response.body();var out=Files.newOutputStream(temp,StandardOpenOption.CREATE,StandardOpenOption.TRUNCATE_EXISTING)){byte[] buf=new byte[8192];int n;while((n=in.read(buf))>=0){bytes+=n;if(bytes>maxBytes)throw new IllegalStateException("Response exceeds size limit");digest.update(buf,0,n);out.write(buf,0,n);}} catch(Exception e){Files.deleteIfExists(temp);throw e;}
        if(bytes==0) {Files.deleteIfExists(temp);throw new IllegalStateException("Empty response");} Files.move(temp,target,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE); String fingerprint=hex(digest.digest()); asset.setStoragePath(root.relativize(target).toString().replace('\\','/'));asset.setFileSize(bytes);asset.setFingerprint(fingerprint);asset.setMimeType(type.isBlank()?"video/mp4":type);asset.setAvailabilityState("AVAILABLE");asset.setUpdatedAt(System.currentTimeMillis());asset.setLastVerifiedAt(System.currentTimeMillis());assetMapper.updateById(asset);return new DownloadResult(assetId,target,bytes,fingerprint);
    }
    private String extension(String path){if(path==null)return "mp4";int i=path.lastIndexOf('.');String value=i<0?"mp4":path.substring(i+1).replaceAll("[^A-Za-z0-9]","").toLowerCase();return value.isBlank()?"mp4":value.length()>8?"mp4":value;}
    private String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format("%02x",b));return s.toString();}
}