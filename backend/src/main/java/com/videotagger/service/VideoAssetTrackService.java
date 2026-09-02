package com.videotagger.service;
import com.videotagger.entity.VideoAssetTrack;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.mapper.VideoAssetTrackMapper;
import org.springframework.stereotype.Service;
import java.util.List;
@Service
public class VideoAssetTrackService {
 private final VideoAssetMapper assets; private final VideoAssetTrackMapper tracks;
 public VideoAssetTrackService(VideoAssetMapper assets,VideoAssetTrackMapper tracks){this.assets=assets;this.tracks=tracks;}
 public List<VideoAssetTrack> list(long assetId){require(assetId);return tracks.listByAsset(assetId);}
 public VideoAssetTrack add(long assetId,VideoAssetTrack track){require(assetId);if(track.getTrackType()==null||!List.of("VIDEO","AUDIO","SUBTITLE").contains(track.getTrackType()))throw new IllegalArgumentException("Invalid track type");long now=System.currentTimeMillis();track.setVideoAssetId(assetId);track.setCreatedAt(now);track.setUpdatedAt(now);tracks.insert(track);return track;}
 public void delete(long assetId,long trackId){require(assetId);VideoAssetTrack track=tracks.selectById(trackId);if(track==null||!track.getVideoAssetId().equals(assetId))throw new IllegalArgumentException("Track not found");tracks.deleteById(trackId);}
 private void require(long id){if(assets.selectById(id)==null)throw new IllegalArgumentException("Asset not found");}
}