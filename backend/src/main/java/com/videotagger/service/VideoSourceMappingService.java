package com.videotagger.service;

import com.videotagger.entity.*;
import com.videotagger.mapper.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class VideoSourceMappingService {
    public record Suggestion(Long sourceItemId, Long episodeId, String reason, double confidence, String status, String conflictCode, String message) {}
    private final VideoSourcePackageMapper packageMapper;
    private final VideoSourceItemMapper itemMapper;
    private final VideoSourceEpisodeMapMapper mappingMapper;
    private final EpisodeMapper episodeMapper;
    private final MediaEntryMapper entryMapper;

    public VideoSourceMappingService(VideoSourcePackageMapper packageMapper, VideoSourceItemMapper itemMapper, VideoSourceEpisodeMapMapper mappingMapper, EpisodeMapper episodeMapper, MediaEntryMapper entryMapper) { this.packageMapper=packageMapper; this.itemMapper=itemMapper; this.mappingMapper=mappingMapper; this.episodeMapper=episodeMapper; this.entryMapper=entryMapper; }

    public List<Suggestion> suggest(long packageId) {
        VideoSourcePackage sourcePackage = packageMapper.selectById(packageId); if(sourcePackage==null) throw new IllegalArgumentException("Source package not found");
        List<VideoSourceItem> items=itemMapper.listByPackage(packageId); List<Episode> episodes=episodeMapper.listByMediaEntry(sourcePackage.getMediaEntryId()); List<Suggestion> result=new ArrayList<>();
        for(VideoSourceItem item:items){ if(item.getEpisodeNo()==null){result.add(new Suggestion(item.getId(),null,"SPECIAL",0.2,"PENDING","NO_EPISODE_NUMBER","Manual mapping required")); continue;} List<Episode> matches=episodes.stream().filter(e->item.getEpisodeNo().equals(e.getEpisodeNo())).toList(); if(matches.size()==1){result.add(new Suggestion(item.getId(),matches.get(0).getId(),"EPISODE_NUMBER",0.9,"SUGGESTED",null,"Unique episode number match"));}else if(matches.isEmpty()){result.add(new Suggestion(item.getId(),null,"EPISODE_NUMBER",0.3,"MISSING","NO_LOCAL_EPISODE","No local Episode"));}else{result.add(new Suggestion(item.getId(),null,"EPISODE_NUMBER",0.1,"CONFLICT","MULTIPLE_LOCAL_EPISODES","Multiple local Episodes match"));} }
        return result;
    }

    public VideoSourceEpisodeMap confirm(long sourceItemId,long episodeId,String reason){ VideoSourceItem item=itemMapper.selectById(sourceItemId); if(item==null)throw new IllegalArgumentException("Source item not found"); VideoSourcePackage sourcePackage=packageMapper.selectById(item.getPackageId()); Episode episode=episodeMapper.selectById(episodeId); if(sourcePackage==null||episode==null||!java.util.Objects.equals(sourcePackage.getMediaEntryId(),episode.getMediaEntryId()))throw new IllegalArgumentException("Episode is outside the source package MediaEntry"); if(mappingMapper.countConfirmedInPackage(item.getPackageId(),episodeId,sourceItemId)>0) throw new IllegalArgumentException("Episode already mapped to another item in this package"); VideoSourceEpisodeMap value=mappingMapper.selectBySourceItem(sourceItemId); long now=System.currentTimeMillis(); if(value==null){value=new VideoSourceEpisodeMap(); value.setSourceItemId(sourceItemId); value.setCreatedAt(now);} value.setEpisodeId(episodeId); value.setMappingReason(reason==null||reason.isBlank()?"MANUAL":reason); value.setConfidence(1d); value.setStatus("CONFIRMED"); value.setManualConfirmed(true); value.setConflictCode(null); value.setConflictMessage(null); value.setUpdatedAt(now); if(value.getId()==null) mappingMapper.insert(value); else mappingMapper.updateById(value); return value; }
    public VideoSourceEpisodeMap ignore(long sourceItemId,String reason){ VideoSourceEpisodeMap value=mappingMapper.selectBySourceItem(sourceItemId); long now=System.currentTimeMillis(); if(value==null){value=new VideoSourceEpisodeMap(); value.setSourceItemId(sourceItemId); value.setCreatedAt(now);} value.setEpisodeId(null); value.setMappingReason(reason==null||reason.isBlank()?"IGNORED":reason); value.setConfidence(1d); value.setStatus("IGNORED"); value.setManualConfirmed(true); value.setUpdatedAt(now); if(value.getId()==null) mappingMapper.insert(value); else mappingMapper.updateById(value); return value; }
    public Episode createEpisode(long packageId,long sourceItemId,Integer episodeNo,String title){ VideoSourcePackage sourcePackage=packageMapper.selectById(packageId); MediaEntry entry=entryMapper.selectById(sourcePackage.getMediaEntryId()); Episode episode=new Episode(); episode.setMediaId(entry.getMediaId()); episode.setMediaEntryId(entry.getId()); episode.setEpisodeNo(episodeNo); episode.setTitle(title); episode.setTitleOverride(1); episode.setCreatedAt(System.currentTimeMillis()); episodeMapper.insert(episode); confirm(sourceItemId,episode.getId(),"MANUAL"); return episode; }
}