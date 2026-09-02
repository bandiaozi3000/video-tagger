package com.videotagger.service;
import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.util.VideoFingerprint;
import org.springframework.stereotype.Service;
@Service
public class VideoAssetClipService {
 public record CreateReferenceClipRequest(String title,long startMs,Long endMs,String tag,String note,String sourceUrl){}
 private final VideoAssetMapper assets;private final ClipMapper clips;public VideoAssetClipService(VideoAssetMapper assets,ClipMapper clips){this.assets=assets;this.clips=clips;}
 public Clip create(long episodeId,long assetId,CreateReferenceClipRequest request){VideoAsset asset=assets.selectById(assetId);if(asset==null||!asset.getEpisodeId().equals(episodeId))throw new IllegalArgumentException("Asset does not belong to Episode");if(request==null||request.startMs()<0||request.endMs()!=null&&request.endMs()<=request.startMs())throw new IllegalArgumentException("Invalid Clip range");if(request.tag()==null||request.tag().isBlank())throw new IllegalArgumentException("Clip tag is required");String url=request.sourceUrl()==null||request.sourceUrl().isBlank()?asset.getStableLocator():request.sourceUrl();if(url==null||url.isBlank())url="video-asset:"+assetId;Clip clip=new Clip();clip.setEpisodeId(episodeId);clip.setVideoAssetId(assetId);clip.setSourceRevision(asset.getSourceRevision());clip.setTitle(request.title()==null||request.title().isBlank()?asset.getDisplayName():request.title());clip.setUrl(url);clip.setVideoFp(VideoFingerprint.fingerprint(url));clip.setStartMs(request.startMs());clip.setEndMs(request.endMs());clip.setTimestampSec(request.startMs()/1000d);clip.setEndSec(request.endMs()==null?null:request.endMs()/1000d);clip.setVideoDuration(asset.getDurationMs()==null?null:asset.getDurationMs()/1000d);clip.setTag(request.tag().trim());clip.setNote(request.note()==null?"":request.note());clip.setMaterialState("AVAILABLE".equals(asset.getAvailabilityState())&&asset.getStoragePath()!=null?"READY":"REFERENCE_ONLY");clip.setCreatedAt(System.currentTimeMillis());clips.insert(clip);return clip;}
}