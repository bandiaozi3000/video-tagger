package com.videotagger.config;

import org.apache.ibatis.mapping.DatabaseIdProvider;
import org.apache.ibatis.mapping.VendorDatabaseIdProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Properties;

/**
 * MyBatis 方言配置：提供 DatabaseIdProvider，供 @Insert/@Select 动态 SQL 用
 * {@code _databaseId} 做方言分支（桌面 SQLite 与 Web MySQL 共用同一套 mapper）。
 * SQLite→sqlite、MySQL→mysql；未匹配则 _databaseId 为 null（走 otherwise）。
 */
@Configuration
public class MybatisConfig {

    @Bean
    public DatabaseIdProvider databaseIdProvider() {
        VendorDatabaseIdProvider provider = new VendorDatabaseIdProvider();
        Properties props = new Properties();
        props.setProperty("SQLite", "sqlite");
        props.setProperty("MySQL", "mysql");
        provider.setProperties(props);
        return provider;
    }
}
