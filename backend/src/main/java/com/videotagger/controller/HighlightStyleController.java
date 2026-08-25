package com.videotagger.controller;

import com.videotagger.service.HighlightStyleCompiler;
import com.videotagger.service.HighlightStylePackRegistry;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/highlight-styles")
public class HighlightStyleController {
    private final HighlightStyleCompiler compiler;
    private final HighlightStylePackRegistry registry;

    public HighlightStyleController(HighlightStyleCompiler compiler, HighlightStylePackRegistry registry) {
        this.compiler = compiler;
        this.registry = registry;
    }

    @GetMapping
    public StyleList list() {
        return new StyleList(compiler.presets(), registry.ids());
    }

    public record StyleList(List<String> presets, List<String> external) { }
}
