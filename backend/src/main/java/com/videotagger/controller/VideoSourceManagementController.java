package com.videotagger.controller;

import com.videotagger.service.VideoSourceSubscriptionService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

@RestController
@RequestMapping("/api/video-source-management")
public class VideoSourceManagementController {
    private final VideoSourceSubscriptionService service;

    public VideoSourceManagementController(VideoSourceSubscriptionService service) {
        this.service = service;
    }

    @GetMapping
    public VideoSourceSubscriptionService.ManagementView management() {
        return service.management();
    }

    @PostMapping("/subscriptions/preview")
    public VideoSourceSubscriptionService.Preview preview(@RequestBody Map<String, String> request) {
        return service.preview(request.get("url"));
    }

    @PostMapping("/subscriptions")
    public VideoSourceSubscriptionService.ManagementView create(
            @RequestBody VideoSourceSubscriptionService.CreateRequest request) {
        return service.create(request);
    }

    @PostMapping("/subscriptions/{id}/refresh")
    public VideoSourceSubscriptionService.ManagementView refresh(@PathVariable long id) {
        return service.refresh(id);
    }

    @DeleteMapping("/subscriptions/{id}")
    public VideoSourceSubscriptionService.ManagementView disable(@PathVariable long id) {
        return service.disableSubscription(id);
    }

    @PatchMapping("/sources/{id}")
    public VideoSourceSubscriptionService.ManagementView updateSource(
            @PathVariable long id,
            @RequestBody VideoSourceSubscriptionService.InstanceUpdate request) {
        return service.updateInstance(id, request);
    }

    @PostMapping("/sources/{id}/test")
    public VideoSourceSubscriptionService.TestResult test(@PathVariable long id,
                                                           @RequestParam(defaultValue = "动画") String keyword) {
        return service.test(id, keyword);
    }
}
