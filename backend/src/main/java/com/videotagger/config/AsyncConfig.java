package com.videotagger.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync(proxyTargetClass = true)
@EnableScheduling
public class AsyncConfig {

    @Bean("embeddingExecutor")
    public Executor embeddingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setThreadNamePrefix("embedding-");
        executor.initialize();
        return executor;
    }

    @Bean("coverExecutor")
    public Executor coverExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setThreadNamePrefix("cover-");
        executor.initialize();
        return executor;
    }

        /**
     * 推荐视频导出专用：单线程顺序渲染，后续任务进入有界队列。
     * 视频渲染不能与 omofuna 同步共用零队列执行器，否则任一任务运行时再次导出会被直接拒绝。
     */
    @Bean("videoExportExecutor")
    public Executor videoExportExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("video-export-");
        executor.initialize();
        return executor;
    }
/**
     * omofuna 抓取专用：单线程、队列 0（并发提交即被拒）。
     * 抓取 20~40 分钟，不能占用 coverExecutor（会堵死封面下载队列）；
     * 单线程保证同刻仅一个抓取任务，配合 OmofunaSyncTaskService.create() 的 RUNNING 预检双保险。
     */
    @Bean("clipExportExecutor")
    public Executor clipExportExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("clip-export-");
        executor.initialize();
        return executor;
    }

    @Bean("highlightSourceExecutor")
    public Executor highlightSourceExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("highlight-source-");
        executor.initialize();
        return executor;
    }

    @Bean("highlightExportExecutor")
    public Executor highlightExportExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(10);
        executor.setThreadNamePrefix("highlight-export-");
        executor.initialize();
        return executor;
    }

    @Bean("syncExecutor")
    public Executor syncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(0);
        executor.setThreadNamePrefix("omofuna-sync-");
        executor.initialize();
        return executor;
    }
}
