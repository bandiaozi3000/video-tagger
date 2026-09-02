package com.videotagger.service;

import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VideoAssetService {
    private final VideoAssetMapper assetMapper;
    private final ClipMapper clipMapper;
    private final com.videotagger.mapper.VideoTimeMappingMapper mappingMapper;
    private final com.videotagger.mapper.VideoSourceTaskMapper taskMapper;
    public VideoAssetService(VideoAssetMapper assetMapper, ClipMapper clipMapper, com.videotagger.mapper.VideoTimeMappingMapper mappingMapper, com.videotagger.mapper.VideoSourceTaskMapper taskMapper){this.assetMapper=assetMapper;this.clipMapper=clipMapper;this.mappingMapper=mappingMapper;this.taskMapper=taskMapper;}
    public List<VideoAsset> list(long episodeId){return assetMapper.listByEpisode(episodeId);}
    public VideoAsset create(VideoAsset asset){if(asset==null||asset.getEpisodeId()==null)throw new IllegalArgumentException("Episode is required"); if(asset.getAssetRole()==null)asset.setAssetRole("UNASSIGNED"); if(asset.getAvailabilityState()==null)asset.setAvailabilityState("UNCHECKED"); long now=System.currentTimeMillis(); if(asset.getCreatedAt()==null)asset.setCreatedAt(now); asset.setUpdatedAt(now); assetMapper.insert(asset); return asset;}
    public VideoAsset select(long episodeId){return assetMapper.selectAvailable(episodeId);}
    public VideoAsset setRole(long assetId,String role){if(!List.of("PRIMARY","FALLBACK","UNASSIGNED").contains(role))throw new IllegalArgumentException("Invalid asset role"); VideoAsset asset=assetMapper.selectById(assetId); if(asset==null)throw new IllegalArgumentException("Asset not found"); if("PRIMARY".equals(role)){long now=System.currentTimeMillis(); assetMapper.demoteOtherPrimary(asset.getEpisodeId(), assetId, now);} asset.setAssetRole(role);asset.setUpdatedAt(System.currentTimeMillis());assetMapper.updateById(asset);return asset;}
    public void delete(long assetId){if(!clipMapper.listByVideoAsset(assetId).isEmpty())throw new IllegalStateException("Asset is referenced by Clip"); if(mappingMapper.countByAsset(assetId)>0)throw new IllegalStateException("Asset is referenced by time mapping"); if(taskMapper.countActiveByAsset(assetId)>0)throw new IllegalStateException("Asset has active task"); if(assetMapper.deleteById(assetId)==0)throw new IllegalArgumentException("Asset not found");}
}