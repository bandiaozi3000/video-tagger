package com.videotagger.controller;

import com.videotagger.service.TitleMappingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** 标题映射 API：查询（扩展浮层「已记住归入」提示用）/ 保存（手动映射用）/ 删除（解除映射）/ 别名列表（媒体详情管理用）。 */
@RestController
@RequestMapping("/api/title-mappings")
public class TitleMappingController {

    private final TitleMappingService titleMappingService;

    public TitleMappingController(TitleMappingService titleMappingService) {
        this.titleMappingService = titleMappingService;
    }

    /** 某媒体的全部别名（映射键），供媒体详情「别名管理」展示。 */
    @GetMapping("/aliases")
    public List<String> aliases(@RequestParam long mediaId) {
        return titleMappingService.listAliasesByMedia(mediaId);
    }

    /** 查询映射：按原始标题解析后查，返回 {parsedTitle, mediaId, mediaTitle}；无映射 mediaId=null。 */
    @GetMapping
    public TitleMappingService.TitleMappingView get(@RequestParam String title) {
        return titleMappingService.resolve(title);
    }

    /** 保存映射：{title, mediaId}（title 可为带集数的原始标题，键按解析后的媒体名存）。 */
    @PostMapping
    public ResponseEntity<?> save(@RequestBody Map<String, String> body) {
        String title = body.get("title");
        String mediaIdStr = body.get("mediaId");
        if (mediaIdStr == null || mediaIdStr.isBlank()) {
            return ResponseEntity.badRequest().body("mediaId 必填");
        }
        long mediaId;
        try {
            mediaId = Long.parseLong(mediaIdStr.trim());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("mediaId 必须是数字");
        }
        String parsed = titleMappingService.saveForRawTitle(title, mediaId);
        if (parsed == null) {
            return ResponseEntity.badRequest().body("标题为空或媒体不存在");
        }
        return ResponseEntity.noContent().build();
    }

    /** 删除映射（解除）：按原始标题解析后删，幂等。 */
    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestParam String title) {
        titleMappingService.deleteForRawTitle(title);
        return ResponseEntity.noContent().build();
    }
}
