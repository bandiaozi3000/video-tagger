package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.service.ClipService;
import com.videotagger.service.ClipUploadService;
import com.videotagger.service.ReviewClipService;
import com.videotagger.service.SaveClipRequest;
import com.videotagger.service.SaveClipResult;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/clips")
public class ClipController {

    private final ClipService clipService;
    private final ReviewClipService reviewClipService;
    private final ClipUploadService clipUploadService;

    public ClipController(ClipService clipService, ReviewClipService reviewClipService,
                          ClipUploadService clipUploadService) {
        this.clipService = clipService;
        this.reviewClipService = reviewClipService;
        this.clipUploadService = clipUploadService;
    }

    @PostMapping
    public SaveClipResult save(@Valid @RequestBody SaveClipRequest req) {
        return clipService.save(req);
    }

    /**
     * 推荐编辑器的「资源视频」上传：媒体下挂一段额外视频，用法同片段（可多个、可设首尾）。
     *
     * <p>落 `data/videos/{指纹}.{扩展名}` + 登记一条**无集**片段（`episode_id = NULL`），
     * 于是推荐准备/物化/预览/导出全部走既有片段通道；归属由草稿的 `mediaClips` 决定。
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Clip uploadResource(@RequestPart("file") MultipartFile file,
                               @RequestParam(value = "title", required = false) String title,
                               @RequestParam(value = "startSec", required = false) Double startSec,
                               @RequestParam(value = "endSec", required = false) Double endSec) throws IOException {
        return clipUploadService.upload(file, title, startSec, endSec);
    }

    @GetMapping("/near")
    public List<Clip> near(@RequestParam String url,
                           @RequestParam double timestampSec,
                           @RequestParam(defaultValue = "10") double window) {
        return clipService.findNearby(url, timestampSec, window);
    }

    /** 片段详情页：返回完整 Clip（含 videoFp / episodeId / coverPath）。 */
    @GetMapping("/media/{mediaId}")
    public List<Clip> listByMedia(@PathVariable Long mediaId) {
        return clipService.listByMedia(mediaId);
    }

    /** 片段详情页：返回完整 Clip（含 videoFp / episodeId / coverPath）。 */
    @GetMapping("/{id}")
    public Clip get(@PathVariable Long id) {
        return clipService.get(id);
    }


    @PutMapping("/{id}")
    public Clip update(@PathVariable Long id, @Valid @RequestBody SaveClipRequest req) {
        return clipService.update(id, req);
    }

    /** 本地回顾弹窗（片段详情）保存：区间按弹窗内文件坐标传，后端换算回原视频坐标并更新本片段。 */
    @PutMapping("/{id}/playback-range")
    public Clip updatePlaybackRange(@PathVariable Long id, @RequestBody ReviewClipService.RangeRequest req) {
        return reviewClipService.updateRange(id, req);
    }

    /** M2：设置片段封面（body = base64 data URL，截图兜底/手动换封面用）。 */
    @PostMapping("/{id}/cover")
    public Clip setCover(@PathVariable Long id, @RequestBody String dataUrl) {
        return clipService.setCoverFromDataUrl(id, dataUrl.trim());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        boolean deleted = clipService.delete(id);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
