package com.videotagger.controller;

import com.videotagger.service.JumpQueue;
import com.videotagger.util.VideoFingerprint;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/jump")
public class JumpController {

    private final JumpQueue jumpQueue;

    public JumpController(JumpQueue jumpQueue) {
        this.jumpQueue = jumpQueue;
    }

    @PostMapping
    public void jump(@RequestBody JumpRequest req) {
        // put/poll 两侧统一走 VideoFingerprint.normalize 作 key，
        // 否则 Web 端带 t= 的原始 URL 与扩展端剔 t 后的 URL 对不上，扩展端自动跳转失配。
        jumpQueue.put(VideoFingerprint.normalize(req.url()), req.timestampSec());
    }

    @GetMapping("/pending")
    public ResponseEntity<Map<String, Double>> pending(@RequestParam("url") String url) {
        Optional<Double> timestamp = jumpQueue.poll(VideoFingerprint.normalize(url));
        return timestamp
                .map(t -> ResponseEntity.ok(Map.of("timestampSec", t)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    public record JumpRequest(String url, Double timestampSec) {
    }
}
