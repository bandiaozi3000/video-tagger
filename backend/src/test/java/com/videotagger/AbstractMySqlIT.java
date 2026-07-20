package com.videotagger;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.MySQLContainer;

@SpringBootTest
public abstract class AbstractMySqlIT {

    // 单例容器：整个测试 JVM 共用一个实例，避免 per-class 重启导致缓存的 Spring 上下文拿到失效的 JDBC URL
    @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0");

    static {
        mysql.start();
    }
}
