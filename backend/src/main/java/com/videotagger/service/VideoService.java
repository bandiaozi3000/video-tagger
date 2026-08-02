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

    /** 按最近活跃排序的视频列表，keyset 分页（cursor = 上一页最后一项的 latest/fp）。 */
    public List<VideoSummary> listVideos(int limit, Long cursorLatest, String cursorFp) {
        long latest = cursorLatest != null ? cursorLatest : Long.MAX_VALUE;
        String fp = cursorFp == null ? "" : cursorFp;
        return clipMapper.listVideos(latest, fp, Math.min(limit, 100));
    }

    /** 某个视频的全部标记点，按时间戳升序（时间线）。 */
    public List<Clip> listClipsByFingerprint(String fp) {
        return clipMapper.listByFingerprint(fp);
    }
}
