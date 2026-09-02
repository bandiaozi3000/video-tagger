package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoAsset;
import com.videotagger.entity.VideoTimeMapping;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.mapper.VideoTimeMappingMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class ClipMaterializationService {
    public record Plan(long clipId, String strategy, Long sourceAssetId, long startMs, Long endMs, String state) {}
    public record Result(long clipId,long generatedAssetId,String storagePath,long durationMs,String state) {}
    private final ClipMapper clipMapper; private final VideoAssetMapper assetMapper; private final VideoTimeMappingMapper mappingMapper; private final Path root; private final String ffmpegPath;
    public ClipMaterializationService(ClipMapper clipMapper,VideoAssetMapper assetMapper,VideoTimeMappingMapper mappingMapper,@Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String root,@Value("${videotagger.render.ffmpeg-path:ffmpeg}") String ffmpegPath){this.clipMapper=clipMapper;this.assetMapper=assetMapper;this.mappingMapper=mappingMapper;this.root=Path.of(root).toAbsolutePath().normalize();this.ffmpegPath=ffmpegPath;}
    public Plan plan(long clipId){Clip clip=require(clipId);long start=start(clip);Long end=end(clip);VideoAsset asset=clip.getVideoAssetId()==null?null:assetMapper.selectById(clip.getVideoAssetId());String strategy=asset!=null&&asset.getStoragePath()!=null&&"AVAILABLE".equals(asset.getAvailabilityState())?"TRIM_LOCAL_ASSET":asset!=null&&"REMOTE_STREAM".equals(asset.getAssetType())?"DOWNLOAD_RANGE_OR_EPISODE":"SOURCE_REQUIRED";return new Plan(clipId,strategy,clip.getVideoAssetId(),start,end,clip.getMaterialState());}
    public Result materialize(long clipId) throws Exception {Clip clip=require(clipId);Plan plan=plan(clipId);if(!"TRIM_LOCAL_ASSET".equals(plan.strategy()))throw new IllegalStateException("Local verified asset is required before trimming");if(plan.endMs()==null||plan.endMs()<=plan.startMs())throw new IllegalArgumentException("Clip end time is required");VideoAsset source=assetMapper.selectById(plan.sourceAssetId());Path input=root.resolve(source.getStoragePath()).normalize();if(!input.startsWith(root)||!Files.isRegularFile(input))throw new IllegalStateException("Source asset file is missing");return cut(clipId,source,input,plan.endMs(),"derived-from:"+source.getId(),source.getSourceRevision());}

    /**
     * M3 C2/C3：从外部绝对路径文件裁剪（Animeko 缓存整集 / 受控下载落盘文件）。
     * 产物与本地资产裁剪一致（GENERATED_CLIP + 时间映射 + READY）。输入文件不移动、不删除。
     */
    public Result materializeFromFile(long clipId, String absoluteInputPath) throws Exception {
        Clip clip=require(clipId);long start=start(clip);Long end=end(clip);
        if(end==null||end<=start)throw new IllegalArgumentException("Clip end time is required");
        Path input=Path.of(absoluteInputPath).toAbsolutePath().normalize();
        if(!Files.isRegularFile(input))throw new IllegalStateException("External source file is missing: "+input);
        VideoAsset synthetic=new VideoAsset();
        synthetic.setId(0L);
        synthetic.setEpisodeId(clip.getEpisodeId()==null?0L:clip.getEpisodeId());
        synthetic.setSourceRevision(clip.getSourceRevision());
        return cut(clipId,synthetic,input,end,"external-file:"+clipId,clip.getSourceRevision());
    }

    /** 公共裁剪实现：ffmpeg -ss start -i input -t duration 生成 GENERATED_CLIP 资产并落映射。 */
    private Result cut(long clipId, VideoAsset source, Path input, long endMs, String stableLocatorNote, String sourceRevision) throws Exception {
        Clip clip=require(clipId);long start=start(clip);state(clipId,"PREPARING");
        VideoAsset generated=new VideoAsset();long now=System.currentTimeMillis();
        long epId=source.getEpisodeId()==null?0L:source.getEpisodeId();
        generated.setEpisodeId(epId);generated.setSourceItemId(source.getSourceItemId());generated.setAssetType("GENERATED_CLIP");generated.setAssetRole("UNASSIGNED");generated.setPriority(0);generated.setAvailabilityState("UNCHECKED");generated.setSourceRevision(sourceRevision);generated.setDisplayName((clip.getTitle()==null?"Clip":clip.getTitle())+" materialized");generated.setStableLocator(stableLocatorNote);generated.setCreatedAt(now);generated.setUpdatedAt(now);assetMapper.insert(generated);
        Path output=VideoAssetPathService.assetPath(root,0,0,epId,generated.getId(),"mp4");Path temp=output.resolveSibling(output.getFileName()+".part.mp4");Files.createDirectories(output.getParent());
        long duration=endMs-start;
        List<String> command=List.of(ffmpegPath,"-y","-ss",seconds(start),"-i",input.toString(),"-t",seconds(duration),"-map","0:v:0?","-map","0:a:0?","-c","copy",temp.toString());
        try{Process process=new ProcessBuilder(command).redirectErrorStream(true).start();String diagnostics=new String(process.getInputStream().readNBytes(32768));if(!process.waitFor(3600,TimeUnit.SECONDS)){process.destroyForcibly();throw new IllegalStateException("ffmpeg trim timed out");}if(process.exitValue()!=0||!Files.isRegularFile(temp)||Files.size(temp)==0)throw new IllegalStateException("ffmpeg trim failed: "+diagnostics);Files.move(temp,output,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);generated.setStoragePath(root.relativize(output).toString().replace('\\','/'));generated.setMimeType("video/mp4");generated.setDurationMs(duration);generated.setFileSize(Files.size(output));generated.setAvailabilityState("AVAILABLE");generated.setLastVerifiedAt(System.currentTimeMillis());generated.setUpdatedAt(System.currentTimeMillis());assetMapper.updateById(generated);
        VideoTimeMapping mapping=null;if(source.getId()!=null&&source.getId()!=0L){mapping=new VideoTimeMapping();mapping.setOldAssetId(source.getId());mapping.setNewAssetId(generated.getId());mapping.setStatus("CONFIRMED");mapping.setOffsetMs(-start);mapping.setDriftRatio(0d);mapping.setConfidence(1d);mapping.setNotes("Materialized clip source range "+start+"-"+endMs);mapping.setCreatedAt(now);mapping.setConfirmedAt(System.currentTimeMillis());mapping.setUpdatedAt(System.currentTimeMillis());mappingMapper.insert(mapping);}
        clip.setVideoAssetId(generated.getId());clip.setTimeMappingId(mapping==null?null:mapping.getId());clip.setStartMs(0L);clip.setEndMs(duration);clip.setTimestampSec(0d);clip.setEndSec(duration/1000d);clip.setMaterialState("READY");clipMapper.updateById(clip);
        return new Result(clipId,generated.getId(),generated.getStoragePath(),duration,"READY");}catch(Exception e){Files.deleteIfExists(temp);assetMapper.deleteById(generated.getId());state(clipId,"FAILED");throw e;}
    }
    public Clip state(long clipId,String state){if(!java.util.List.of("REFERENCE_ONLY","PREPARING","READY","FAILED").contains(state))throw new IllegalArgumentException("Invalid material state");Clip clip=require(clipId);clip.setMaterialState(state);clipMapper.updateById(clip);return clip;}
    private long start(Clip clip){return clip.getStartMs()!=null?clip.getStartMs():Math.round(clip.getTimestampSec()*1000);}
    private Long end(Clip clip){return clip.getEndMs()!=null?clip.getEndMs():clip.getEndSec()==null?null:Math.round(clip.getEndSec()*1000);}
    private String seconds(long ms){return String.format(java.util.Locale.ROOT,"%.3f",ms/1000d);}
    private Clip require(long id){Clip clip=clipMapper.selectById(id);if(clip==null)throw new IllegalArgumentException("Clip not found");return clip;}
}