package com.videotagger;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class VideoTaggerApplication {

    public static void main(String[] args) {
        SpringApplication.run(VideoTaggerApplication.class, args);
    }
}
