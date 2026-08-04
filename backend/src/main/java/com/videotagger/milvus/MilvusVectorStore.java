package com.videotagger.milvus;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.videotagger.config.EmbeddingProperties;
import com.videotagger.config.MilvusProperties;
import com.videotagger.service.EntityType;
import com.videotagger.service.VectorStore;
import io.milvus.v2.client.ConnectConfig;
import io.milvus.v2.client.MilvusClientV2;
import io.milvus.v2.common.DataType;
import io.milvus.v2.common.IndexParam;
import io.milvus.v2.service.index.request.CreateIndexReq;
import io.milvus.v2.service.collection.request.CreateCollectionReq;
import io.milvus.v2.service.collection.request.HasCollectionReq;
import io.milvus.v2.service.collection.request.LoadCollectionReq;
import io.milvus.v2.service.vector.request.DeleteReq;
import io.milvus.v2.service.vector.request.SearchReq;
import io.milvus.v2.service.vector.request.UpsertReq;
import io.milvus.v2.service.vector.request.data.FloatVec;
import io.milvus.v2.service.vector.response.SearchResp;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Milvus 向量存储：单 collection + 组合主键 (entity_type, entity_id)。
 * 主键为 VarChar 字符串（如 "A:1" / "E:2" / "C:3"），另加 entity_type 标量字段供按层过滤。
 * 三层共享同一 embedding 模型与维度，混合搜索一次 ANN 跨层召回。
 */
@Primary
@Component
public class MilvusVectorStore implements VectorStore {

    private static final Logger log = LoggerFactory.getLogger(MilvusVectorStore.class);
    private static final int CONNECT_RETRIES = 3;
    // 相似度下限来自配置 videotagger.milvus.min-cosine-score：
    // COSINE 指标下 score 即余弦相似度（越高越相关），低于阈值视为噪声召回（乱搜/无关查询），直接丢弃

    private final MilvusProperties milvusProps;
    private final EmbeddingProperties embeddingProps;

    private MilvusClientV2 client;
    private volatile boolean enabled = false;

    public MilvusVectorStore(MilvusProperties milvusProps, EmbeddingProperties embeddingProps) {
        this.milvusProps = milvusProps;
        this.embeddingProps = embeddingProps;
    }

    @PostConstruct
    public void init() {
        for (int attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
            if (tryConnect()) {
                enabled = true;
                log.info("Milvus 连接成功，collection={} 就绪", milvusProps.getCollection());
                return;
            }
            log.warn("Milvus 连接失败（第 {}/{} 次），3 秒后重试", attempt, CONNECT_RETRIES);
            sleepQuietly(3_000);
        }
        log.error("Milvus 不可用，应用将以纯关键词模式运行，每 60 秒自动尝试重连");
    }

    /** 冷启动竞态兜底：禁用态每 60 秒重连，成功后语义搜索自动恢复。 */
    @Scheduled(fixedDelay = 60_000)
    public void reconnectIfDisabled() {
        if (enabled) {
            return;
        }
        if (tryConnect()) {
            enabled = true;
            log.info("Milvus 重连成功，语义搜索已恢复（collection={}）", milvusProps.getCollection());
        }
    }

    private boolean tryConnect() {
        MilvusClientV2 newClient;
        try {
            newClient = new MilvusClientV2(ConnectConfig.builder().uri(milvusProps.getUri()).build());
        } catch (Exception e) {
            log.warn("Milvus 连接失败：{}", e.getMessage());
            return false;
        }
        try {
            ensureCollection(newClient);
            if (client != null && client != newClient) {
                closeQuietly(client);
            }
            client = newClient;
            return true;
        } catch (Exception e) {
            closeQuietly(newClient); // 防止失败时泄漏 gRPC channel
            log.warn("Milvus 连接失败：{}", e.getMessage());
            return false;
        }
    }

    private void ensureCollection(MilvusClientV2 c) {
        String name = milvusProps.getCollection();
        boolean exists = c.hasCollection(HasCollectionReq.builder().collectionName(name).build());
        if (!exists) {
            CreateCollectionReq.CollectionSchema schema = CreateCollectionReq.CollectionSchema.builder()
                    .fieldSchemaList(List.of(
                            CreateCollectionReq.FieldSchema.builder()
                                    .name("id").dataType(DataType.VarChar).maxLength(64).isPrimaryKey(true).build(),
                            CreateCollectionReq.FieldSchema.builder()
                                    .name("entity_type").dataType(DataType.VarChar).maxLength(16).build(),
                            CreateCollectionReq.FieldSchema.builder()
                                    .name("vector").dataType(DataType.FloatVector)
                                    .dimension(embeddingProps.getDim()).build()))
                    .build();
            c.createCollection(CreateCollectionReq.builder()
                    .collectionName(name)
                    .collectionSchema(schema)
                    .metricType("COSINE")
                    .build());
            log.info("创建 Milvus collection {}（dim={}，组合主键 entity_type:id）", name, embeddingProps.getDim());
        }
        // 建向量索引：load 前必需；对新建与既有 collection 统一幂等执行（同名索引重复创建会被 Milvus 忽略）
        try {
            c.createIndex(CreateIndexReq.builder()
                    .collectionName(name)
                    .indexParams(List.of(IndexParam.builder()
                            .fieldName("vector")
                            .indexType(IndexParam.IndexType.AUTOINDEX)
                            .metricType(IndexParam.MetricType.COSINE)
                            .build()))
                    .build());
        } catch (Exception e) {
            log.warn("创建向量索引跳过（可能已存在）：{}", e.getMessage());
        }
        // 搜索 / 查询前必须 load；对既有与新建的 collection 统一执行，避免 cold start 后搜索报未加载
        c.loadCollection(LoadCollectionReq.builder().collectionName(name).build());
    }

    private void closeQuietly(MilvusClientV2 c) {
        try {
            c.close();
        } catch (Exception ignored) {
        }
    }

    @Override
    public void upsert(EntityType type, long entityId, float[] vector) {
        if (!enabled) {
            return;
        }
        try {
            JsonObject row = new JsonObject();
            row.addProperty("id", key(type, entityId));
            row.addProperty("entity_type", type.name());
            JsonArray arr = new JsonArray();
            for (float f : vector) {
                arr.add(f);
            }
            row.add("vector", arr);
            client.upsert(UpsertReq.builder()
                    .collectionName(milvusProps.getCollection())
                    .data(List.of(row))
                    .build());
        } catch (Exception e) {
            log.error("Milvus upsert 失败（{}:{}）：{}", type, entityId, e.getMessage());
        }
    }

    @Override
    public List<VectorHit> search(float[] queryVector, int topK) {
        return doSearch(queryVector, topK, null);
    }

    @Override
    public List<VectorHit> search(EntityType type, float[] queryVector, int topK) {
        return doSearch(queryVector, topK, type);
    }

    private List<VectorHit> doSearch(float[] queryVector, int topK, EntityType filter) {
        if (!enabled) {
            return List.of();
        }
        try {
            List<Float> query = new ArrayList<>(queryVector.length);
            for (float f : queryVector) {
                query.add(f);
            }
            SearchReq.SearchReqBuilder<?, ?> builder = SearchReq.builder()
                    .collectionName(milvusProps.getCollection())
                    .data(List.of(new FloatVec(query)))
                    .topK(topK);
            if (filter != null) {
                builder.filter("entity_type == \"" + filter.name() + "\"");
            }
            SearchResp resp = client.search(builder.build());
            List<VectorHit> hits = new ArrayList<>();
            List<List<SearchResp.SearchResult>> results = resp.getSearchResults();
            if (results != null && !results.isEmpty()) {
                for (SearchResp.SearchResult r : results.get(0)) {
                    if (r.getScore() < milvusProps.getMinCosineScore()) {
                        continue;
                    }
                    VectorHit hit = parseHit(r.getId().toString(), r.getScore());
                    if (hit != null) {
                        hits.add(hit);
                    }
                }
            }
            return hits;
        } catch (Exception e) {
            log.error("Milvus search 失败：{}", e.getMessage());
            return List.of();
        }
    }

    @Override
    public void delete(EntityType type, long entityId) {
        if (!enabled) {
            return;
        }
        try {
            client.delete(DeleteReq.builder()
                    .collectionName(milvusProps.getCollection())
                    .ids(List.of(key(type, entityId)))
                    .build());
        } catch (Exception e) {
            log.error("Milvus delete 失败（{}:{}）：{}", type, entityId, e.getMessage());
        }
    }

    private static String key(EntityType type, long entityId) {
        return type.name().charAt(0) + ":" + entityId;
    }

    private static VectorHit parseHit(String id, double score) {
        int colon = id.indexOf(':');
        if (colon <= 0) {
            return null;
        }
        String prefix = id.substring(0, colon);
        EntityType type;
        switch (prefix) {
            case "A" -> type = EntityType.ANIME;
            case "E" -> type = EntityType.EPISODE;
            case "C" -> type = EntityType.CLIP;
            default -> {
                return null;
            }
        }
        return new VectorHit(type, Long.parseLong(id.substring(colon + 1)), score);
    }

    private void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
