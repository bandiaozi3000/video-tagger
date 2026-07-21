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
            try {
                client = new MilvusClientV2(ConnectConfig.builder().uri(milvusProps.getUri()).build());
                ensureCollection();
                enabled = true;
                log.info("Milvus 连接成功，collection={} 就绪", milvusProps.getCollection());
                return;
            } catch (Exception e) {
                log.warn("Milvus 连接失败（第 {}/{} 次）：{}", attempt, CONNECT_RETRIES, e.getMessage());
                sleepQuietly(3_000);
            }
        }
        log.error("Milvus 不可用，应用将以纯关键词模式运行");
    }

    private void ensureCollection() {
        String name = milvusProps.getCollection();
        boolean exists = client.hasCollection(HasCollectionReq.builder().collectionName(name).build());
        if (!exists) {
            client.createCollection(CreateCollectionReq.builder()
                    .collectionName(name)
                    .dimension(embeddingProps.getDim())
                    .metricType("COSINE")
                    .build());
            log.info("创建 Milvus collection {}（dim={}）", name, embeddingProps.getDim());
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
