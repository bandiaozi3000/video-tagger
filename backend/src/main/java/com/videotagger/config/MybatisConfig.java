package com.videotagger.config;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

// @MapperScan 独立于主类：@WebMvcTest 等切片测试不加载普通 @Configuration，
// 避免在无 MyBatis 基础设施的切片中实例化 Mapper Bean（见 HealthIT 注释中的同类问题）
@Configuration
@MapperScan("com.videotagger.mapper")
public class MybatisConfig {
}
