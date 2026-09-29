package com.videotagger.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.CoverTemplateRow;
import com.videotagger.mapper.CoverTemplateMapper;
import com.videotagger.service.CoverRenderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 封面工坊（2026-09-29）：出图 + 常用模板。
 *
 * 只有两件事：
 *   1. `/export` —— 把编辑器画布的 HTML+CSS 交给 {@link CoverRenderService} 出图（Chrome → JPEG）
 *   2. `/templates` —— 「常用模板」新删改查（参数组合，不含具体片段）
 *
 * **生成的封面不入库**：文件落在 `covers/make/`，参数随推荐草稿保存（`EditorConfig.cover`），
 * 所以「回到上次的设置」靠草稿回填，不需要产物行。真要做生成历史再补表。
 */
@RestController
@RequestMapping("/api/cover")
public class CoverController {

    private final CoverRenderService renderService;
    private final CoverTemplateMapper templateMapper;

    public CoverController(CoverRenderService renderService, CoverTemplateMapper templateMapper) {
        this.renderService = renderService;
        this.templateMapper = templateMapper;
    }

    /** 出图：请求体见 {@link CoverRenderService.ExportRequest}。 */
    @PostMapping("/export")
    public CoverRenderService.ExportResult export(@RequestBody CoverRenderService.ExportRequest request) {
        return renderService.export(request.html(), request.css(), request.name());
    }

    /** 常用模板列表（最近更新的在前）。 */
    @GetMapping("/templates")
    public List<CoverTemplateRow> templates() {
        return templateMapper.selectList(
                new QueryWrapper<CoverTemplateRow>().orderByDesc("updated_at").orderByDesc("id"));
    }

    /** 存为常用模板（同名则覆盖 —— 用户改完参数再存一次是常态）。 */
    @PostMapping("/templates")
    public Map<String, Long> saveTemplate(@RequestBody SaveTemplateRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("模板名不能为空");
        }
        if (request.config() == null || request.config().isBlank()) {
            throw new IllegalArgumentException("模板内容为空");
        }
        long now = System.currentTimeMillis();
        CoverTemplateRow existing = templateMapper.selectOne(
                new QueryWrapper<CoverTemplateRow>().eq("name", name).last("limit 1"));
        if (existing != null) {
            existing.setConfig(request.config());
            existing.setUpdatedAt(now);
            templateMapper.updateById(existing);
            return Map.of("id", existing.getId());
        }
        CoverTemplateRow row = new CoverTemplateRow();
        row.setName(name);
        row.setConfig(request.config());
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        templateMapper.insert(row);
        return Map.of("id", row.getId());
    }

    /** 删除模板（不影响已生成的封面文件）。 */
    @DeleteMapping("/templates/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable long id) {
        templateMapper.deleteById(id);
        return ResponseEntity.ok().build();
    }

    /** 重命名（只改名字，参数不动）。 */
    @PutMapping("/templates/{id}/name")
    public ResponseEntity<Void> renameTemplate(@PathVariable long id, @RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("模板名不能为空");
        }
        CoverTemplateRow row = templateMapper.selectById(id);
        if (row == null) {
            return ResponseEntity.notFound().build();
        }
        row.setName(name);
        row.setUpdatedAt(System.currentTimeMillis());
        templateMapper.updateById(row);
        return ResponseEntity.ok().build();
    }

    public record SaveTemplateRequest(String name, String config) {
    }
}
