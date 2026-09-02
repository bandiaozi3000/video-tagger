package com.videotagger.controller;

import com.videotagger.service.AnimekoActivator;
import com.videotagger.service.AnimekoTagService;
import com.videotagger.service.AnimekoWatchImportService;
import org.springframework.web.bind.annotation.*;

/** v0.24 Animeko 观看事实导入：状态预览 + 手动导入 + M2 现场播放头/打标。 */
@RestController
@RequestMapping("/api/animeko/watch")
public class AnimekoWatchController {

    private final AnimekoWatchImportService service;
    private final AnimekoTagService tagService;
    private final AnimekoActivator activator;

    public AnimekoWatchController(AnimekoWatchImportService service, AnimekoTagService tagService,
                                  AnimekoActivator activator) {
        this.service = service;
        this.tagService = tagService;
        this.activator = activator;
    }

    /** Animeko DB 可达性 + 有效播放记录数预览（不写库）。 */
    @GetMapping("/status")
    public AnimekoWatchImportService.Status status() {
        return service.status();
    }

    /** 把最近播放历史按 Bangumi id 桥映射回本地 Episode 并标记 watchedAt。 */
    @PostMapping("/import")
    public AnimekoWatchImportService.ImportResult importWatchHistory() {
        return service.importWatchHistory();
    }

    /** M2：Animeko 最近一条有效播放记录（暂停即落盘）→ 浮层上下文。 */
    @GetMapping("/playhead")
    public AnimekoTagService.PlayheadView playhead() {
        return tagService.mappedPlayhead();
    }

    /** M2：现场打标——按播放头映射建 Clip（带渠道线索），未建档返回 NEED_ARCHIVE。 */
    @PostMapping("/tag")
    public AnimekoTagService.TagResult tag(@RequestBody AnimekoTagService.TagRequest request) {
        return tagService.tag(request);
    }

    /** M3：唤起 Animeko 桌面端窗口置前（无深链定位；运行中则激活，未运行则启动）。 */
    @PostMapping("/activate")
    public AnimekoActivator.ActivateResult activate() {
        return activator.activate();
    }
}
