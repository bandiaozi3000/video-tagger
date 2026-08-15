package com.videotagger.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// @MapperScan 独立于主类：@WebMvcTest 等切片测试不加载普通 @Configuration，
// 避免在无 MyBatis 基础设施的切片中实例化 Mapper Bean（见 HealthIT 注释中的同类问题）
@Configuration
@MapperScan("com.videotagger.mapper")
public class MybatisConfig {

    /** MyBatis-Plus 分页 + 方言：桌面版 SQLite 唯一数据源。 */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.SQLITE));
        return interceptor;
    }
}
