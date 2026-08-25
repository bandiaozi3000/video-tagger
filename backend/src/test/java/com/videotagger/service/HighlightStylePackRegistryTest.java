package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class HighlightStylePackRegistryTest {
    @Test
    void loadsDeclarativePackAndRejectsScripts() throws Exception {
        Path dir = Files.createTempDirectory("highlight-styles-test-");
        HighlightProperties properties = new HighlightProperties();
        properties.setStyleDir(dir.toString());
        HighlightStylePackRegistry registry = new HighlightStylePackRegistry(new ObjectMapper(), properties);
        Files.writeString(dir.resolve("rose.json"), "{\"style\":{\"transitionRenderer\":\"fade-black\"}}");
        assertEquals("fade-black", registry.load("rose").get("transitionRenderer").asText());
        Files.writeString(dir.resolve("unsafe.json"), "{\"script\":\"alert(1)\"}");
        assertThrows(IllegalArgumentException.class, () -> registry.load("unsafe"));
    }
}
