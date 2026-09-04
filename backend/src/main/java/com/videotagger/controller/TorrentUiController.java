package com.videotagger.controller;

import com.videotagger.videosource.TorrentUiService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** v0.25 种子源下载 UI 支撑端点。 */
@RestController
@RequestMapping("/api/torrents")
public class TorrentUiController {

    private final TorrentUiService service;

    public TorrentUiController(TorrentUiService service) {
        this.service = service;
    }

    public record SearchRequest(String title, Integer episodeNumber, java.util.List<String> aliases) {
    }

    @PostMapping("/candidates")
    public List<TorrentUiService.CandidateDto> candidates(@RequestBody SearchRequest request) {
        return service.searchCandidates(request == null ? null : request.title(),
                request == null ? null : request.aliases(), 200);
    }

    @PostMapping("/pack-episodes")
    public TorrentUiService.PackView packEpisodes(@RequestBody java.util.Map<String, String> body) throws Exception {
        return service.packEpisodes(body == null ? null : body.get("locator"));
    }

    @PostMapping("/measure")
    public List<TorrentUiService.MeasureEntry> measure(
            @RequestBody java.util.Map<String, java.util.List<String>> body) throws Exception {
        return service.measure(body == null ? null : body.get("locators"));
    }

    @GetMapping("/engine-status")
    public TorrentUiService.EngineStatus engineStatus() {
        return service.engineStatus();
    }
}
