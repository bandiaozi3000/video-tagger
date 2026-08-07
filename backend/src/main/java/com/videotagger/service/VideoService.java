package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VideoService {

    private final ClipMapper clipMapper;

    public VideoService(ClipMapper clipMapper) {
        this.clipMapper = clipMapper;
    }

    /** 按最近活跃排序的视频列表，offset 分页（页码导航）。 */
    public List<VideoSummary> listVideos(int limit, int offset) {
        return clipMapper.listVideos(Math.min(limit, 200), offset);
    }

    /** 有标记的视频总数，供分页导航。 */
    public long countVideos() {
        return clipMapper.countVideos();
    }

    /** 某个视频的全部标记点，按时间戳升序（时间线）。 */
    public List<Clip> listClipsByFingerprint(String fp) {
        return clipMapper.listByFingerprint(fp);
    }
}
