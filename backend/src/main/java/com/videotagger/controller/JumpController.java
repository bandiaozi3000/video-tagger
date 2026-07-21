package com.videotagger.controller;

import com.videotagger.service.JumpQueue;
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
        jumpQueue.put(req.url(), req.timestampSec());
    }

    @GetMapping("/pending")
    public ResponseEntity<Map<String, Double>> pending(@RequestParam("url") String url) {
        Optional<Double> timestamp = jumpQueue.poll(url);
        return timestamp
                .map(t -> ResponseEntity.ok(Map.of("timestampSec", t)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    public record JumpRequest(String url, Double timestampSec) {
    }
}
