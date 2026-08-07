package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.util.VideoFingerprint;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class VideoServiceIT extends AbstractMySqlIT {

    @Autowired
    ClipService clipService;

    @Autowired
    VideoService videoService;

    @Autowired
    ClipMapper clipMapper;

    /** 静态 @Container 在各 IT 类间共享，清空本类数据做隔离 */
    @BeforeEach
    void cleanTable() {
        clipMapper.delete(null);
    }

    @Test
    void listVideosGroupsSameVideoAcrossTrackingParams() {
        clipService.save(new SaveClipRequest("某动画", "https://vt-group.test/1?from=search&spm=x", 10.0, "高燃", ""));
        clipService.save(new SaveClipRequest("某动画", "https://vt-group.test/1?vd_source=abc", 20.0, "名场面", ""));

        String fp = VideoFingerprint.fingerprint("https://vt-group.test/1");
        List<Clip> clips = videoService.listClipsByFingerprint(fp);
        assertEquals(2, clips.size());

        VideoSummary group = videoService.listVideos(100, 0).stream()
                .filter(v -> v.fp().equals(fp))
                .findFirst()
                .orElse(null);
        assertNotNull(group);
        assertEquals(2, group.count());
    }

    @Test
    void listClipsByFingerprintOrdersByTimestamp() {
        clipService.save(new SaveClipRequest("某动画", "https://vt-order.test/2", 20.0, "名场面", ""));
        clipService.save(new SaveClipRequest("某动画", "https://vt-order.test/2", 10.0, "高燃", ""));

        String fp = VideoFingerprint.fingerprint("https://vt-order.test/2");
        List<Clip> clips = videoService.listClipsByFingerprint(fp);

        assertEquals(2, clips.size());
        assertEquals("高燃", clips.get(0).getTag()); // 10s 在前
        assertEquals("名场面", clips.get(1).getTag());
    }

    @Test
    void offsetPaginationReturnsNextPage() {
        for (int i = 0; i < 5; i++) {
            clipService.save(new SaveClipRequest("视频" + i, "https://vt-page.test/" + i, 1.0, "标签", ""));
        }

        List<VideoSummary> page1 = videoService.listVideos(2, 0);
        assertEquals(2, page1.size());
        VideoSummary last = page1.get(page1.size() - 1);

        List<VideoSummary> page2 = videoService.listVideos(2, 2);
        assertEquals(2, page2.size());
        assertEquals(0, page2.stream().filter(p2 -> p2.fp().equals(last.fp())).count());
    }
}
