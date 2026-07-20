package com.videotagger;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
@MapperScan("com.videotagger.mapper")
public class VideoTaggerApplication {

    public static void main(String[] args) {
        SpringApplication.run(VideoTaggerApplication.class, args);
    }
}
