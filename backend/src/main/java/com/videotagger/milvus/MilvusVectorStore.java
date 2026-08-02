package com.videotagger.milvus;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.videotagger.config.EmbeddingProperties;
import com.videotagger.config.MilvusProperties;
import com.videotagger.service.VectorStore;
import io.milvus.v2.client.ConnectConfig;
import io.milvus.v2.client.MilvusClientV2;
import io.milvus.v2.service.collection.request.CreateCollectionReq;
import io.milvus.v2.service.collection.request.HasCollectionReq;
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

@Primary
@Component
public class MilvusVectorStore implements VectorStore {

    private static final Logger log = LoggerFactory.getLogger(MilvusVectorStore.class);
    private static final int CONNECT_RETRIES = 3;

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

    /**
     * 冷启动竞态兜底：compose 中 Milvus 可能晚于 app 就绪，init 阶段连不上时
     * enabled 保持 false；此后每 60 秒尝试重连一次，成功后语义搜索自动恢复，无需重启应用。
     */
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
            c.createCollection(CreateCollectionReq.builder()
                    .collectionName(name)
                    .dimension(embeddingProps.getDim())
                    .metricType("COSINE")
                    .build());
            log.info("创建 Milvus collection {}（dim={}）", name, embeddingProps.getDim());
        }
    }

    private void closeQuietly(MilvusClientV2 c) {
        try {
            c.close();
        } catch (Exception ignored) {
        }
    }

    @Override
    public void upsert(long clipId, float[] vector) {
        if (!enabled) {
            return;
        }
        try {
            JsonObject row = new JsonObject();
            row.addProperty("id", clipId);
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
            log.error("Milvus upsert 失败（clipId={}）：{}", clipId, e.getMessage());
        }
    }

    @Override
    public List<VectorHit> search(float[] queryVector, int topK) {
        if (!enabled) {
            return List.of();
        }
        try {
            List<Float> query = new ArrayList<>(queryVector.length);
            for (float f : queryVector) {
                query.add(f);
            }
            SearchResp resp = client.search(SearchReq.builder()
                    .collectionName(milvusProps.getCollection())
                    .data(List.of(new FloatVec(query)))
                    .topK(topK)
                    .build());
            List<VectorHit> hits = new ArrayList<>();
            List<List<SearchResp.SearchResult>> results = resp.getSearchResults();
            if (results != null && !results.isEmpty()) {
                for (SearchResp.SearchResult r : results.get(0)) {
                    hits.add(new VectorHit(Long.parseLong(r.getId().toString()), r.getScore()));
                }
            }
            return hits;
        } catch (Exception e) {
            log.error("Milvus search 失败：{}", e.getMessage());
            return List.of();
        }
    }

    @Override
    public void delete(long clipId) {
        if (!enabled) {
            return;
        }
        try {
            client.delete(DeleteReq.builder()
                    .collectionName(milvusProps.getCollection())
                    .ids(List.of(clipId))
                    .build());
        } catch (Exception e) {
            log.error("Milvus delete 失败（clipId={}）：{}", clipId, e.getMessage());
        }
    }

    private void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
