package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.util.VideoFingerprint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/** 启动时为 V2 迁移前保存的历史标签补齐 video_fp（新标签保存时已由 ClipService 写入）。 */
@Component
public class VideoFingerprintBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(VideoFingerprintBackfill.class);

    private final ClipMapper clipMapper;

    public VideoFingerprintBackfill(ClipMapper clipMapper) {
        this.clipMapper = clipMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<Clip> missing = clipMapper.selectList(
                    new LambdaQueryWrapper<Clip>().isNull(Clip::getVideoFp));
            if (missing.isEmpty()) {
                return;
            }
            for (Clip clip : missing) {
                clip.setVideoFp(VideoFingerprint.fingerprint(clip.getUrl()));
                clipMapper.updateById(clip);
            }
            log.info("已为 {} 条历史标签回填 video_fp", missing.size());
        } catch (Exception e) {
            log.warn("回填 video_fp 失败（不影响启动）：{}", e.getMessage());
        }
    }
}
