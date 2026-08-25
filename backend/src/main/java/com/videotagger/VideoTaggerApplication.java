package com.videotagger;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
@ConfigurationPropertiesScan
@MapperScan("com.videotagger.mapper")
public class VideoTaggerApplication {

    public static void main(String[] args) {
        ensureDataDirs();
        SpringApplication.run(VideoTaggerApplication.class, args);
    }

    /**
     * 启动前确保数据目录存在（SQLite 库 + 封面/站点/导出目录）。
     * SQLite JDBC 不自动创建父目录（MySQL 会），且桌面版数据放 %APPDATA% 时目录也需先建。
     * VT_DATA_DIR 覆盖数据根（桌面版由壳注入）；默认相对 cwd 的 data/。
     */
    static void ensureDataDirs() {
        String root = System.getenv("VT_DATA_DIR");
        Path base = root != null && !root.isBlank() ? Paths.get(root) : Paths.get("data");
        for (String s : new String[]{"", "covers", "site", "exports", "logs", "videos", "clip-videos", "clip-images", "highlight-projects"}) {
            try {
                Files.createDirectories(s.isEmpty() ? base : base.resolve(s));
            } catch (Exception e) {
                System.err.println("[data] 目录创建失败: " + s + " -> " + e.getMessage());
            }
        }
    }
}
