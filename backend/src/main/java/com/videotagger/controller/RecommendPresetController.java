package com.videotagger.controller;

import com.videotagger.entity.RecommendDraft;
import com.videotagger.entity.RecommendTemplate;
import com.videotagger.service.RecommendPresetService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 推荐预设：草稿（GET/PUT）+ 模板（CRUD）。config 为 JSON 字符串。 */
@RestController
@RequestMapping("/api/recommend")
public class RecommendPresetController {

    private final RecommendPresetService presetService;

    public RecommendPresetController(RecommendPresetService presetService) {
        this.presetService = presetService;
    }

    @GetMapping("/draft")
    public Map<String, Object> draft() {
        RecommendDraft d = presetService.loadDraft();
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("config", d == null ? null : d.getConfig());
        r.put("updatedAt", d == null ? null : d.getUpdatedAt());
        return r;
    }

    @PutMapping("/draft")
    public ResponseEntity<Void> saveDraft(@RequestBody Map<String, String> body) {
        presetService.saveDraft(body.get("config"));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/templates")
    public List<RecommendTemplate> templates() {
        return presetService.listTemplates();
    }

    @PutMapping("/templates/{id}")
    public RecommendTemplate updateTemplate(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return presetService.updateTemplate(id, body.get("name"), body.get("config"));
    }

    @PostMapping("/templates")
    public RecommendTemplate createTemplate(@RequestBody Map<String, String> body) {
        return presetService.saveTemplate(body.get("name"), body.get("config"));
    }

    @GetMapping("/templates/{id}")
    public RecommendTemplate template(@PathVariable Long id) {
        return presetService.getTemplate(id);
    }

    @DeleteMapping("/templates/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        presetService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }
}
