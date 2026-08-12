package com.videotagger.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties("videotagger.vector")
public class VectorProperties {
    /**
     * 向量功能总开关：false 时不连 Milvus、不生成 embedding、不写向量任务，
     * 搜索自动降级纯关键词（semanticEnabled=false）。后续要恢复向量功能时置 true 即可。
     */
    private boolean enabled = true;
}
