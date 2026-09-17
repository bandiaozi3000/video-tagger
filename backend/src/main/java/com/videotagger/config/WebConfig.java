package com.videotagger.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/** 静态资源映射：/covers/** → 封面，/site/bg/** → 背景图，/exports/** → 导出产物（前端可 fetch 写入用户所选位置）。 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String coverDir;
    private final String siteBgDir;
    private final String exportDir;
    private final String clipVideoDir;
    private final String clipImageDir;
    private final String recommendPreviewDir;
    private final String remotionPlayerDir;

    public WebConfig(@Value("${videotagger.cover-dir:data/covers}") String coverDir,
                     @Value("${videotagger.site-dir:data/site}") String siteDir,
                     @Value("${videotagger.export-dir:data/exports}") String exportDir,
                     @Value("${videotagger.clip-export.video-output-dir:data/clip-videos}") String clipVideoDir,
                     @Value("${videotagger.clip-export.image-output-dir:data/clip-images}") String clipImageDir,
                     @Value("${videotagger.render.remotion-dir:backend/remotion}") String remotionDir) {
        this.coverDir = Paths.get(coverDir).toAbsolutePath() + "/";
        this.siteBgDir = Paths.get(siteDir).resolve("bg").toAbsolutePath() + "/";
        this.exportDir = Paths.get(exportDir).toAbsolutePath() + "/";
        this.clipVideoDir = Paths.get(clipVideoDir).toAbsolutePath() + "/";
        this.clipImageDir = Paths.get(clipImageDir).toAbsolutePath() + "/";
        this.recommendPreviewDir = Paths.get("data/recommend-previews").toAbsolutePath() + "/";
        this.remotionPlayerDir = resolvePlayerDir(remotionDir) + "/";
    }

    /** Remotion Player 静态包目录：IDE（cwd=项目根）与 mvn（cwd=backend）两种启动方式都要能命中。 */
    private static java.nio.file.Path resolvePlayerDir(String remotionDir) {
        List<Path> candidates = List.of(
                Paths.get(remotionDir),
                Paths.get("..").resolve(remotionDir),
                Paths.get(remotionDir).toAbsolutePath(),
                Paths.get("backend/remotion"),
                Paths.get("../backend/remotion"));
        for (java.nio.file.Path candidate : candidates) {
            if (java.nio.file.Files.isDirectory(candidate.resolve("dist-player"))) {
                return candidate.resolve("dist-player").toAbsolutePath().normalize();
            }
        }
        return Paths.get(remotionDir).toAbsolutePath().resolve("dist-player");
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
        registry.addResourceHandler("/recommend-previews/**")
                .addResourceLocations("file:" + recommendPreviewDir);
        // Remotion Player 预览页静态包（dist-player/；未构建时该路由 404，/preview 会回退旧 HTML）
        registry.addResourceHandler("/recommend-player/**")
                .addResourceLocations("file:" + remotionPlayerDir);
    }
}
