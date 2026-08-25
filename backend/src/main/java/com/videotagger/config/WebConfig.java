package com.videotagger.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/** 静态资源映射：/covers/** → 封面，/site/bg/** → 背景图，/exports/** → 导出产物（前端可 fetch 写入用户所选位置）。 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String coverDir;
    private final String siteBgDir;
    private final String exportDir;
    private final String clipVideoDir;
    private final String clipImageDir;

    public WebConfig(@Value("${videotagger.cover-dir:data/covers}") String coverDir,
                     @Value("${videotagger.site-dir:data/site}") String siteDir,
                     @Value("${videotagger.export-dir:data/exports}") String exportDir,
                     @Value("${videotagger.clip-export.video-output-dir:data/clip-videos}") String clipVideoDir,
                     @Value("${videotagger.clip-export.image-output-dir:data/clip-images}") String clipImageDir) {
        this.coverDir = Paths.get(coverDir).toAbsolutePath() + "/";
        this.siteBgDir = Paths.get(siteDir).resolve("bg").toAbsolutePath() + "/";
        this.exportDir = Paths.get(exportDir).toAbsolutePath() + "/";
        this.clipVideoDir = Paths.get(clipVideoDir).toAbsolutePath() + "/";
        this.clipImageDir = Paths.get(clipImageDir).toAbsolutePath() + "/";
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/covers/**")
                .addResourceLocations("file:" + coverDir);
        registry.addResourceHandler("/site/bg/**")
                .addResourceLocations("file:" + siteBgDir);
        registry.addResourceHandler("/exports/**")
                .addResourceLocations("file:" + exportDir);
        registry.addResourceHandler("/clip-videos/**")
                .addResourceLocations("file:" + clipVideoDir);
        registry.addResourceHandler("/clip-images/**")
                .addResourceLocations("file:" + clipImageDir);
    }
}
