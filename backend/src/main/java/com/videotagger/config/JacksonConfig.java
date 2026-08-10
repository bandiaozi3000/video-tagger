package com.videotagger.config;

import com.fasterxml.jackson.core.StreamReadConstraints;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 提高 Jackson JSON 字符串解析上限：推荐导出的 BGM 多曲 base64 内嵌（base64 放大 ~33%），
 * 单曲 20MB 原始文件编码后即超默认 20MB（StreamReadConstraints.getMaxStringLength）→ 生成预览 500。
 * 调大到 100MB 留足余量；前端另有 BGM 总量 60MB 限制兜底。
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer streamReadConstraintsCustomizer() {
        return builder -> builder.postConfigurer(mapper ->
                mapper.getFactory().setStreamReadConstraints(
                        StreamReadConstraints.builder().maxStringLength(100_000_000).build()));
    }
}
