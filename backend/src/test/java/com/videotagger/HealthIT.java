package com.videotagger;

import com.baomidou.mybatisplus.autoconfigure.MybatisPlusAutoConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 使用测试局部配置引导：不加载主类 @MapperScan（避免在无 MyBatis 基础设施时实例化 Mapper Bean），
// 专注验证自动配置装配下 actuator 健康端点可用；完整应用上下文的启动由 ClipMapperIT 覆盖。
@SpringBootTest(classes = HealthIT.TestConfig.class)
@AutoConfigureMockMvc
class HealthIT {

    // 注意：不能用 @SpringBootConfiguration，否则会干扰其他测试的引导类发现
    @Configuration
    @EnableAutoConfiguration(exclude = {DataSourceAutoConfiguration.class, MybatisPlusAutoConfiguration.class})
    static class TestConfig {
    }

    @Autowired
    MockMvc mvc;

    @Test
    void healthIsUp() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
