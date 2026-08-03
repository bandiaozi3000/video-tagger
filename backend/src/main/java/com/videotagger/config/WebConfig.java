package com.videotagger.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/** 封面静态资源映射：/covers/** → 本地封面目录。 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String coverDir;

    public WebConfig(@Value("${videotagger.cover-dir:data/covers}") String coverDir) {
        this.coverDir = Paths.get(coverDir).toAbsolutePath() + "/";
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/covers/**")
                .addResourceLocations("file:" + coverDir);
    }
}
