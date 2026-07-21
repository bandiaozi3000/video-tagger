# Video Tagger 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「网页视频打标签 + 混合语义搜索 + 一键回看」工具：浏览器扩展抓取片段，Java 后端存储与检索，Web UI 搜索，Docker Compose 一键部署。

**Architecture:** Spring Boot REST API（保存/搜索/跳转队列）+ MySQL 8（ngram 全文召回）+ Milvus（向量召回，接口隔离）+ RRF 融合；MV3 扩展页面内浮层打标签；原生静态 Web UI 由后端托管。

**Tech Stack:** Java 17, Spring Boot 3.3.4, MyBatis-Plus 3.5.7, milvus-sdk-java 2.4.5, MySQL 8.0, Milvus v2.4.x, JUnit5 + Mockito + Testcontainers, Manifest V3, 原生 HTML/CSS/JS。

**对应规格：** `docs/superpowers/specs/2026-07-20-video-tagger-design.md`

## Global Constraints

- JDK 17、Maven 3.9+、Docker Desktop 运行中（Testcontainers 与 compose 依赖）。
- 包名根：`com.videotagger`；后端子项目目录 `backend/`。
- 端口：后端 `8080`；MySQL `3306`；Milvus `19530`（本地开发映射，部署时仅 8080 对外）。
- RRF 常数 `k=60`；跳转队列 TTL `30_000ms`；保存去重窗口 `3_000ms`；Embedding 重试上限 `5` 次。
- Embedding API 走 OpenAI 兼容接口，配置全走环境变量，**禁止硬编码 Key**；未配置时降级为纯关键词搜索。
- 数据库字符集 utf8mb4；全文索引用 `WITH PARSER ngram`。
- UI 色系：背景 `#1e1e2e`、卡片 `#313244`、强调色 `#cba6f7`；不引入前端框架与构建链。
- 提交信息格式：`type: 中文描述`（与首个提交一致）。
- 与规格的偏差说明：规格中的 `MilvusCollectionManager` 合并进 `MilvusVectorStore`（初始化+存取单文件，职责仍单一）；`FusionService` 命名为 `RrfFusion` 工具类。

---

### Task 1: Spring Boot 项目骨架

**Files:**
- Create: `backend/pom.xml`
- Create: `backend/src/main/java/com/videotagger/VideoTaggerApplication.java`
- Create: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/com/videotagger/HealthIT.java`

**Interfaces:**
- Produces: `VideoTaggerApplication`（含 `@ConfigurationPropertiesScan`，后续配置类直接注册）；`application.yml` 中 `videotagger.milvus.*` / `videotagger.embedding.*` 配置键。

- [ ] **Step 1: 写 pom.xml 与失败的测试**

`backend/pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.4</version>
        <relativePath/>
    </parent>
    <groupId>com.videotagger</groupId>
    <artifactId>video-tagger-backend</artifactId>
    <version>0.1.0</version>
    <properties>
        <java.version>17</java.version>
    </properties>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
            <version>3.5.7</version>
        </dependency>
        <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.milvus</groupId>
            <artifactId>milvus-sdk-java</artifactId>
            <version>2.4.5</version>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-testcontainers</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>mysql</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>junit-jupiter</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>com.squareup.okhttp3</groupId>
            <artifactId>mockwebserver</artifactId>
            <version>4.12.0</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

`backend/src/test/java/com/videotagger/HealthIT.java`：

```java
package com.videotagger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=" +
        "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration," +
        "com.baomidou.mybatisplus.autoconfigure.MybatisPlusAutoConfiguration"
})
@AutoConfigureMockMvc
class HealthIT {

    @Autowired
    MockMvc mvc;

    @Test
    void healthIsUp() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test -Dtest=HealthIT`
Expected: 编译失败，`VideoTaggerApplication` 不存在。

- [ ] **Step 3: 写主类与配置**

`backend/src/main/java/com/videotagger/VideoTaggerApplication.java`：

```java
package com.videotagger;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
@MapperScan("com.videotagger.mapper")
public class VideoTaggerApplication {

    public static void main(String[] args) {
        SpringApplication.run(VideoTaggerApplication.class, args);
    }
}
```

`backend/src/main/resources/application.yml`：

```yaml
server:
  port: 8080

spring:
  application:
    name: video-tagger
  datasource:
    url: jdbc:mysql://localhost:3306/video_tagger?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false
    username: root
    password: ${MYSQL_ROOT_PASSWORD:root123456}
  sql:
    init:
      mode: always

mybatis-plus:
  configuration:
    map-underscore-to-camel-case: true

videotagger:
  milvus:
    uri: ${MILVUS_URI:http://localhost:19530}
    collection: clip_embeddings
  embedding:
    base-url: ${EMBEDDING_BASE_URL:}
    api-key: ${EMBEDDING_API_KEY:}
    model: ${EMBEDDING_MODEL:text-embedding-3-small}
    dim: ${EMBEDDING_DIM:1024}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test -Dtest=HealthIT`
Expected: PASS（Tests run: 1, Failures: 0）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: Spring Boot 项目骨架与健康检查"
```

---

### Task 2: MySQL 表结构 + 实体与 Mapper + 基础设施 compose

**Files:**
- Create: `docker-compose.yml`（仅基础设施：mysql/etcd/minio/milvus）
- Create: `backend/src/main/resources/schema.sql`
- Create: `backend/src/main/java/com/videotagger/entity/Clip.java`
- Create: `backend/src/main/java/com/videotagger/entity/EmbeddingTask.java`
- Create: `backend/src/main/java/com/videotagger/mapper/ClipMapper.java`
- Create: `backend/src/main/java/com/videotagger/mapper/EmbeddingTaskMapper.java`
- Test: `backend/src/test/java/com/videotagger/AbstractMySqlIT.java`
- Test: `backend/src/test/java/com/videotagger/mapper/ClipMapperIT.java`

**Interfaces:**
- Produces: `Clip{Long id; String title; String url; Double timestampSec; String tag; String note; Long createdAt}`；`EmbeddingTask{Long clipId; String status; Integer retryCount; Long updatedAt}`；`AbstractMySqlIT`（后续所有 DB 集成测试的基类）。

- [ ] **Step 1: 写失败的集成测试**

`backend/src/test/java/com/videotagger/AbstractMySqlIT.java`：

```java
package com.videotagger;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
public abstract class AbstractMySqlIT {

    @Container
    @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0");
}
```

`backend/src/test/java/com/videotagger/mapper/ClipMapperIT.java`：

```java
package com.videotagger.mapper;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Clip;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ClipMapperIT extends AbstractMySqlIT {

    @Autowired
    ClipMapper clipMapper;

    @Test
    void insertAndSelectById() {
        Clip clip = new Clip();
        clip.setTitle("某动画 第3集");
        clip.setUrl("https://www.bilibili.com/video/BV1xx");
        clip.setTimestampSec(754.5);
        clip.setTag("高燃战斗");
        clip.setNote("主角觉醒");
        clip.setCreatedAt(System.currentTimeMillis());

        clipMapper.insert(clip);

        Clip loaded = clipMapper.selectById(clip.getId());
        assertNotNull(loaded);
        assertEquals("高燃战斗", loaded.getTag());
        assertEquals(754.5, loaded.getTimestampSec());
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test -Dtest=ClipMapperIT`
Expected: 编译失败（`Clip`/`ClipMapper` 不存在）。

- [ ] **Step 3: 写 schema、实体、Mapper、compose**

`backend/src/main/resources/schema.sql`：

```sql
CREATE TABLE IF NOT EXISTS clips (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    title         VARCHAR(512) NOT NULL,
    url           VARCHAR(1024) NOT NULL,
    timestamp_sec DOUBLE NOT NULL,
    tag           VARCHAR(512) NOT NULL,
    note          TEXT,
    created_at    BIGINT NOT NULL,
    FULLTEXT KEY ft_title_tag_note (title, tag, note) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS embedding_tasks (
    clip_id     BIGINT PRIMARY KEY,
    status      VARCHAR(16) NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    updated_at  BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`backend/src/main/java/com/videotagger/entity/Clip.java`：

```java
package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("clips")
public class Clip {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String url;
    private Double timestampSec;
    private String tag;
    private String note;
    private Long createdAt;
}
```

`backend/src/main/java/com/videotagger/entity/EmbeddingTask.java`：

```java
package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("embedding_tasks")
public class EmbeddingTask {
    @TableId(type = IdType.INPUT)
    private Long clipId;
    private String status;
    private Integer retryCount;
    private Long updatedAt;
}
```

`backend/src/main/java/com/videotagger/mapper/ClipMapper.java`：

```java
package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Clip;

public interface ClipMapper extends BaseMapper<Clip> {
}
```

`backend/src/main/java/com/videotagger/mapper/EmbeddingTaskMapper.java`：

```java
package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.EmbeddingTask;

public interface EmbeddingTaskMapper extends BaseMapper<EmbeddingTask> {
}
```

`docker-compose.yml`（项目根目录，仅基础设施；app 服务在 Task 17 加入）：

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: vt-mysql
    environment:
      MYSQL_ROOT_PASSWORD: root123456
      MYSQL_DATABASE: video_tagger
      TZ: Asia/Shanghai
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot123456"]
      interval: 5s
      timeout: 3s
      retries: 20

  etcd:
    image: quay.io/coreos/etcd:v3.5.14
    container_name: vt-etcd
    environment:
      ETCD_AUTO_COMPACTION_MODE: revision
      ETCD_AUTO_COMPACTION_RETENTION: "1000"
      ETCD_QUOTA_BACKEND_BYTES: "4294967296"
      ETCD_SNAPSHOT_COUNT: "50000"
    volumes:
      - etcd_data:/etcd
    command: etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd

  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    container_name: vt-minio
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - minio_data:/minio_data
    command: minio server /minio_data --console-address ":9001"

  milvus:
    image: milvusdb/milvus:v2.4.13
    container_name: vt-milvus
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    ports:
      - "19530:19530"
    volumes:
      - milvus_data:/var/lib/milvus
    depends_on:
      - etcd
      - minio

volumes:
  mysql_data:
  etcd_data:
  minio_data:
  milvus_data:
```

- [ ] **Step 4: 运行测试确认通过（需 Docker Desktop 运行中）**

Run: `mvn -q -f backend/pom.xml test -Dtest=ClipMapperIT`
Expected: PASS（Testcontainers 自动起一次性 MySQL 容器）

- [ ] **Step 5: 提交**

```powershell
git add docker-compose.yml backend/
git commit -m "feat: MySQL 表结构、实体 Mapper 与基础设施 compose"
```

---

### Task 3: ClipService 保存 + 3 秒去重

**Files:**
- Create: `backend/src/main/java/com/videotagger/service/SaveClipRequest.java`
- Create: `backend/src/main/java/com/videotagger/service/SaveClipResult.java`
- Create: `backend/src/main/java/com/videotagger/service/ClipService.java`
- Modify: `backend/src/main/java/com/videotagger/mapper/ClipMapper.java`（追加 `findRecentByUrl`）
- Test: `backend/src/test/java/com/videotagger/service/ClipServiceIT.java`

**Interfaces:**
- Consumes: Task 2 的 `Clip`、`EmbeddingTask`、`ClipMapper`、`EmbeddingTaskMapper`。
- Produces: `record SaveClipRequest(String title, String url, Double timestampSec, String tag, String note)`；`record SaveClipResult(Long id, boolean deduped)`；`ClipService.save(SaveClipRequest) -> SaveClipResult`（Task 4 控制器使用）。

- [ ] **Step 1: 写失败的测试**

`backend/src/test/java/com/videotagger/service/ClipServiceIT.java`：

```java
package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.mapper.EmbeddingTaskMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.*;

class ClipServiceIT extends AbstractMySqlIT {

    @Autowired
    ClipService clipService;

    @Autowired
    EmbeddingTaskMapper taskMapper;

    @Test
    void saveCreatesClipAndPendingTask() {
        SaveClipResult result = clipService.save(new SaveClipRequest(
                "某动画 第3集", "https://www.bilibili.com/video/BV1", 754.5, "高燃战斗", "主角觉醒"));

        assertFalse(result.deduped());
        assertNotNull(result.id());
        assertEquals("PENDING", taskMapper.selectById(result.id()).getStatus());
    }

    @Test
    void saveSameUrlWithin3SecondsDeduplicates() {
        SaveClipRequest req = new SaveClipRequest(
                "某动画 第3集", "https://www.bilibili.com/video/BV2", 100.0, "战斗", "");

        SaveClipResult first = clipService.save(req);
        SaveClipResult second = clipService.save(req);

        assertTrue(second.deduped());
        assertEquals(first.id(), second.id());
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test -Dtest=ClipServiceIT`
Expected: 编译失败（`ClipService` 等不存在）。

- [ ] **Step 3: 实现**

`backend/src/main/java/com/videotagger/service/SaveClipRequest.java`：

```java
package com.videotagger.service;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SaveClipRequest(
        @NotBlank String title,
        @NotBlank String url,
        @NotNull @DecimalMin("0.0") Double timestampSec,
        @NotBlank String tag,
        String note
) {
}
```

`backend/src/main/java/com/videotagger/service/SaveClipResult.java`：

```java
package com.videotagger.service;

public record SaveClipResult(Long id, boolean deduped) {
}
```

`backend/src/main/java/com/videotagger/mapper/ClipMapper.java`（全量替换）：

```java
package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Clip;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface ClipMapper extends BaseMapper<Clip> {

    @Select("SELECT * FROM clips WHERE url = #{url} AND created_at > #{since} ORDER BY id DESC LIMIT 1")
    Clip findRecentByUrl(@Param("url") String url, @Param("since") long since);
}
```

`backend/src/main/java/com/videotagger/service/ClipService.java`：

```java
package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.EmbeddingTask;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EmbeddingTaskMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClipService {

    private static final long DEDUP_WINDOW_MS = 3_000;

    private final ClipMapper clipMapper;
    private final EmbeddingTaskMapper taskMapper;

    public ClipService(ClipMapper clipMapper, EmbeddingTaskMapper taskMapper) {
        this.clipMapper = clipMapper;
        this.taskMapper = taskMapper;
    }

    @Transactional
    public SaveClipResult save(SaveClipRequest req) {
        long now = System.currentTimeMillis();

        Clip recent = clipMapper.findRecentByUrl(req.url(), now - DEDUP_WINDOW_MS);
        if (recent != null) {
            return new SaveClipResult(recent.getId(), true);
        }

        Clip clip = new Clip();
        clip.setTitle(req.title());
        clip.setUrl(req.url());
        clip.setTimestampSec(req.timestampSec());
        clip.setTag(req.tag());
        clip.setNote(req.note() == null ? "" : req.note());
        clip.setCreatedAt(now);
        clipMapper.insert(clip);

        EmbeddingTask task = new EmbeddingTask();
        task.setClipId(clip.getId());
        task.setStatus("PENDING");
        task.setRetryCount(0);
        task.setUpdatedAt(now);
        taskMapper.insert(task);

        return new SaveClipResult(clip.getId(), false);
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test -Dtest=ClipServiceIT`
Expected: PASS（Tests run: 2）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: 标签保存服务与 3 秒去重"
```

---

### Task 4: ClipController + CORS

**Files:**
- Create: `backend/src/main/java/com/videotagger/controller/ClipController.java`
- Create: `backend/src/main/java/com/videotagger/config/CorsConfig.java`
- Test: `backend/src/test/java/com/videotagger/controller/ClipControllerTest.java`

**Interfaces:**
- Consumes: Task 3 的 `ClipService.save`、`SaveClipRequest`、`SaveClipResult`。
- Produces: `POST /api/clips`，请求体 `SaveClipRequest`，响应 `SaveClipResult`（扩展 background.js 使用）。

- [ ] **Step 1: 写失败的测试**

`backend/src/test/java/com/videotagger/controller/ClipControllerTest.java`：

```java
package com.videotagger.controller;

import com.videotagger.service.ClipService;
import com.videotagger.service.SaveClipResult;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ClipController.class)
class ClipControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    ClipService clipService;

    @Test
    void saveReturnsId() throws Exception {
        Mockito.when(clipService.save(any())).thenReturn(new SaveClipResult(42L, false));

        mvc.perform(post("/api/clips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"某动画 第3集","url":"https://www.bilibili.com/video/BV1",
                                 "timestampSec":754.5,"tag":"高燃战斗","note":""}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.deduped").value(false));
    }

    @Test
    void saveRejectsBlankTag() throws Exception {
        mvc.perform(post("/api/clips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"t","url":"https://a.com","timestampSec":1.0,"tag":""}
                                """))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test -Dtest=ClipControllerTest`
Expected: 编译失败（`ClipController` 不存在）。

- [ ] **Step 3: 实现**

`backend/src/main/java/com/videotagger/controller/ClipController.java`：

```java
package com.videotagger.controller;

import com.videotagger.service.ClipService;
import com.videotagger.service.SaveClipRequest;
import com.videotagger.service.SaveClipResult;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/clips")
public class ClipController {

    private final ClipService clipService;

    public ClipController(ClipService clipService) {
        this.clipService = clipService;
    }

    @PostMapping
    public SaveClipResult save(@Valid @RequestBody SaveClipRequest req) {
        return clipService.save(req);
    }
}
```

`backend/src/main/java/com/videotagger/config/CorsConfig.java`：

```java
package com.videotagger.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("chrome-extension://*", "http://localhost:*", "http://127.0.0.1:*")
                .allowedMethods("*")
                .allowedHeaders("*");
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test -Dtest=ClipControllerTest`
Expected: PASS（Tests run: 2）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: 标签保存接口与 CORS 配置"
```

---

### Task 5: 关键词召回（ngram 全文检索）

**Files:**
- Modify: `backend/src/main/java/com/videotagger/mapper/ClipMapper.java`（追加 `fullTextSearch`）
- Test: `backend/src/test/java/com/videotagger/mapper/ClipFullTextIT.java`

**Interfaces:**
- Produces: `ClipMapper.fullTextSearch(String q, int limit) -> List<Clip>`（按相关度降序，Task 10 SearchService 使用）。

- [ ] **Step 1: 写失败的测试**

`backend/src/test/java/com/videotagger/mapper/ClipFullTextIT.java`：

```java
package com.videotagger.mapper;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Clip;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClipFullTextIT extends AbstractMySqlIT {

    @Autowired
    ClipMapper clipMapper;

    private Clip clip(String tag, String note) {
        Clip c = new Clip();
        c.setTitle("某动画");
        c.setUrl("https://a.com/" + tag);
        c.setTimestampSec(1.0);
        c.setTag(tag);
        c.setNote(note);
        c.setCreatedAt(System.currentTimeMillis());
        return c;
    }

    @Test
    void fullTextSearchMatchesChineseTag() {
        clipMapper.insert(clip("高燃战斗场面", ""));
        clipMapper.insert(clip("温馨日常", ""));
        clipMapper.insert(clip("主角战斗爆发击败反派", "高潮"));

        List<Clip> hits = clipMapper.fullTextSearch("战斗", 10);

        assertEquals(2, hits.size());
    }

    @Test
    void fullTextSearchNoMatchReturnsEmpty() {
        clipMapper.insert(clip("高燃战斗场面", ""));

        List<Clip> hits = clipMapper.fullTextSearch("预算会议", 10);

        assertEquals(0, hits.size());
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test -Dtest=ClipFullTextIT`
Expected: 编译失败（`fullTextSearch` 不存在）。

- [ ] **Step 3: 实现（向 ClipMapper 追加方法）**

`backend/src/main/java/com/videotagger/mapper/ClipMapper.java`（全量替换）：

```java
package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Clip;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface ClipMapper extends BaseMapper<Clip> {

    @Select("SELECT * FROM clips WHERE url = #{url} AND created_at > #{since} ORDER BY id DESC LIMIT 1")
    Clip findRecentByUrl(@Param("url") String url, @Param("since") long since);

    @Select("SELECT * FROM clips "
            + "WHERE MATCH(title, tag, note) AGAINST(#{q} IN NATURAL LANGUAGE MODE) "
            + "ORDER BY MATCH(title, tag, note) AGAINST(#{q} IN NATURAL LANGUAGE MODE) DESC "
            + "LIMIT #{limit}")
    List<Clip> fullTextSearch(@Param("q") String q, @Param("limit") int limit);
}
```

注：MySQL ngram 默认二元分词，查询词至少 2 个汉字时效果稳定，这是已知行为。

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test -Dtest=ClipFullTextIT`
Expected: PASS（Tests run: 2）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: ngram 全文关键词召回"
```

---

### Task 6: EmbeddingClient（OpenAI 兼容客户端）

**Files:**
- Create: `backend/src/main/java/com/videotagger/config/EmbeddingProperties.java`
- Create: `backend/src/main/java/com/videotagger/service/EmbeddingClient.java`
- Test: `backend/src/test/java/com/videotagger/service/EmbeddingClientTest.java`

**Interfaces:**
- Produces: `EmbeddingClient.embed(String text) -> float[]`；`EmbeddingClient.isConfigured() -> boolean`（Task 7、10 使用）。

- [ ] **Step 1: 写失败的测试**

`backend/src/test/java/com/videotagger/service/EmbeddingClientTest.java`：

```java
package com.videotagger.service;

import com.videotagger.config.EmbeddingProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EmbeddingClientTest {

    @Test
    void embedParsesVector() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(new MockResponse()
                    .setBody("{\"data\":[{\"embedding\":[0.5,0.25]}]}")
                    .addHeader("Content-Type", "application/json"));
            server.start();

            EmbeddingProperties props = new EmbeddingProperties();
            props.setBaseUrl(server.url("/").toString());
            props.setApiKey("test-key");
            props.setModel("test-model");

            EmbeddingClient client = new EmbeddingClient(props);
            float[] vector = client.embed("测试文本");

            assertArrayEquals(new float[]{0.5f, 0.25f}, vector);
        }
    }

    @Test
    void isConfiguredFalseWhenKeyBlank() {
        EmbeddingProperties props = new EmbeddingProperties();
        props.setBaseUrl("http://localhost:1234");
        props.setApiKey("");

        assertFalse(new EmbeddingClient(props).isConfigured());
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test -Dtest=EmbeddingClientTest`
Expected: 编译失败（`EmbeddingClient` 不存在）。

- [ ] **Step 3: 实现**

`backend/src/main/java/com/videotagger/config/EmbeddingProperties.java`：

```java
package com.videotagger.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties("videotagger.embedding")
public class EmbeddingProperties {
    private String baseUrl = "";
    private String apiKey = "";
    private String model = "text-embedding-3-small";
    private int dim = 1024;
}
```

`backend/src/main/java/com/videotagger/service/EmbeddingClient.java`：

```java
package com.videotagger.service;

import com.videotagger.config.EmbeddingProperties;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
public class EmbeddingClient {

    private final EmbeddingProperties props;
    private volatile RestClient restClient;

    public EmbeddingClient(EmbeddingProperties props) {
        this.props = props;
    }

    public boolean isConfigured() {
        return StringUtils.hasText(props.getApiKey()) && StringUtils.hasText(props.getBaseUrl());
    }

    public float[] embed(String text) {
        EmbeddingApiResponse resp = client().post()
                .uri("/embeddings")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("model", props.getModel(), "input", text))
                .retrieve()
                .body(EmbeddingApiResponse.class);

        if (resp == null || resp.data() == null || resp.data().isEmpty()) {
            throw new IllegalStateException("Embedding API 返回为空");
        }
        List<Float> values = resp.data().get(0).embedding();
        float[] vector = new float[values.size()];
        for (int i = 0; i < values.size(); i++) {
            vector[i] = values.get(i);
        }
        return vector;
    }

    private RestClient client() {
        if (restClient == null) {
            synchronized (this) {
                if (restClient == null) {
                    restClient = RestClient.builder()
                            .baseUrl(props.getBaseUrl())
                            .defaultHeader("Authorization", "Bearer " + props.getApiKey())
                            .build();
                }
            }
        }
        return restClient;
    }

    record EmbeddingApiResponse(List<EmbeddingApiData> data) {
    }

    record EmbeddingApiData(List<Float> embedding) {
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test -Dtest=EmbeddingClientTest`
Expected: PASS（Tests run: 2）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: OpenAI 兼容 Embedding 客户端"
```

---

### Task 7: EmbeddingTaskService（异步生成 + 退避重试）

**Files:**
- Create: `backend/src/main/java/com/videotagger/service/VectorStore.java`
- Create: `backend/src/main/java/com/videotagger/config/AsyncConfig.java`
- Create: `backend/src/main/java/com/videotagger/service/EmbeddingTaskService.java`
- Modify: `backend/src/main/java/com/videotagger/mapper/EmbeddingTaskMapper.java`（追加 `selectPending`）
- Test: `backend/src/test/java/com/videotagger/service/EmbeddingTaskServiceTest.java`

**Interfaces:**
- Consumes: Task 6 的 `EmbeddingClient`。
- Produces: `VectorStore` 接口（`upsert(long, float[])` / `search(float[], int) -> List<VectorHit>` / `delete(long)`，内嵌 `record VectorHit(long clipId, double score)`；Task 8/9 实现，Task 10 消费）；`EmbeddingTaskService.process(long)` / `processAsync(long)` / `sweep()`。

- [ ] **Step 1: 写失败的测试**

`backend/src/test/java/com/videotagger/service/EmbeddingTaskServiceTest.java`：

```java
package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.EmbeddingTask;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EmbeddingTaskMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class EmbeddingTaskServiceTest {

    ClipMapper clipMapper;
    EmbeddingTaskMapper taskMapper;
    EmbeddingClient embeddingClient;
    VectorStore vectorStore;
    EmbeddingTaskService service;

    @BeforeEach
    void setUp() {
        clipMapper = mock(ClipMapper.class);
        taskMapper = mock(EmbeddingTaskMapper.class);
        embeddingClient = mock(EmbeddingClient.class);
        vectorStore = mock(VectorStore.class);
        service = new EmbeddingTaskService(clipMapper, taskMapper, embeddingClient, vectorStore);
    }

    private Clip clip(long id) {
        Clip c = new Clip();
        c.setId(id);
        c.setTag("高燃战斗");
        c.setNote("主角觉醒");
        return c;
    }

    private EmbeddingTask pendingTask(long clipId, int retryCount, long updatedAt) {
        EmbeddingTask t = new EmbeddingTask();
        t.setClipId(clipId);
        t.setStatus("PENDING");
        t.setRetryCount(retryCount);
        t.setUpdatedAt(updatedAt);
        return t;
    }

    @Test
    void processSkipsWhenNotConfigured() {
        when(embeddingClient.isConfigured()).thenReturn(false);

        service.process(1L);

        verifyNoInteractions(vectorStore);
        verify(taskMapper, never()).updateById(any());
    }

    @Test
    void processSuccessUpsertsAndMarksDone() {
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed("高燃战斗 主角觉醒")).thenReturn(new float[]{0.1f});
        when(clipMapper.selectById(1L)).thenReturn(clip(1L));
        EmbeddingTask task = pendingTask(1L, 0, System.currentTimeMillis());
        when(taskMapper.selectById(1L)).thenReturn(task);

        service.process(1L);

        verify(vectorStore).upsert(eq(1L), any(float[].class));
        assertEquals("DONE", task.getStatus());
        verify(taskMapper).updateById(task);
    }

    @Test
    void processFailureIncrementsRetry() {
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed(anyString())).thenThrow(new RuntimeException("API 超时"));
        when(clipMapper.selectById(1L)).thenReturn(clip(1L));
        EmbeddingTask task = pendingTask(1L, 1, System.currentTimeMillis());
        when(taskMapper.selectById(1L)).thenReturn(task);

        service.process(1L);

        assertEquals(2, task.getRetryCount());
        assertEquals("PENDING", task.getStatus());
    }

    @Test
    void processFailureAtRetry4MarksFailed() {
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed(anyString())).thenThrow(new RuntimeException("API 超时"));
        when(clipMapper.selectById(1L)).thenReturn(clip(1L));
        EmbeddingTask task = pendingTask(1L, 4, System.currentTimeMillis());
        when(taskMapper.selectById(1L)).thenReturn(task);

        service.process(1L);

        assertEquals(5, task.getRetryCount());
        assertEquals("FAILED", task.getStatus());
    }

    @Test
    void sweepOnlyProcessesDueTasks() {
        long now = System.currentTimeMillis();
        EmbeddingTask due = pendingTask(1L, 1, now - 5_000);    // 退避 2^1*1000=2s，已到期
        EmbeddingTask notDue = pendingTask(2L, 3, now - 5_000); // 退避 2^3*1000=8s，未到期
        when(taskMapper.selectPending()).thenReturn(List.of(due, notDue));
        when(embeddingClient.isConfigured()).thenReturn(true); // process 推进到 selectById 后因 clip 为 null 早退，便于观察调用

        service.sweep();

        verify(taskMapper).selectById(1L);
        verify(taskMapper, never()).selectById(2L);
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test -Dtest=EmbeddingTaskServiceTest`
Expected: 编译失败（`EmbeddingTaskService`、`VectorStore` 不存在）。

- [ ] **Step 3: 实现**

`backend/src/main/java/com/videotagger/service/VectorStore.java`：

```java
package com.videotagger.service;

import java.util.List;

public interface VectorStore {

    void upsert(long clipId, float[] vector);

    /** 按相似度从高到低返回 */
    List<VectorHit> search(float[] queryVector, int topK);

    void delete(long clipId);

    record VectorHit(long clipId, double score) {
    }
}
```

`backend/src/main/java/com/videotagger/mapper/EmbeddingTaskMapper.java`（全量替换）：

```java
package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.EmbeddingTask;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface EmbeddingTaskMapper extends BaseMapper<EmbeddingTask> {

    @Select("SELECT * FROM embedding_tasks WHERE status = 'PENDING' AND retry_count < 5")
    List<EmbeddingTask> selectPending();
}
```

`backend/src/main/java/com/videotagger/config/AsyncConfig.java`：

```java
package com.videotagger.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig {

    @Bean("embeddingExecutor")
    public Executor embeddingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setThreadNamePrefix("embedding-");
        executor.initialize();
        return executor;
    }
}
```

`backend/src/main/java/com/videotagger/service/EmbeddingTaskService.java`：

```java
package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.EmbeddingTask;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EmbeddingTaskMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmbeddingTaskService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingTaskService.class);
    private static final int MAX_RETRY = 5;

    private final ClipMapper clipMapper;
    private final EmbeddingTaskMapper taskMapper;
    private final EmbeddingClient embeddingClient;
    private final VectorStore vectorStore;

    public EmbeddingTaskService(ClipMapper clipMapper, EmbeddingTaskMapper taskMapper,
                                EmbeddingClient embeddingClient, VectorStore vectorStore) {
        this.clipMapper = clipMapper;
        this.taskMapper = taskMapper;
        this.embeddingClient = embeddingClient;
        this.vectorStore = vectorStore;
    }

    @Async("embeddingExecutor")
    public void processAsync(long clipId) {
        process(clipId);
    }

    public void process(long clipId) {
        if (!embeddingClient.isConfigured()) {
            return;
        }
        Clip clip = clipMapper.selectById(clipId);
        EmbeddingTask task = taskMapper.selectById(clipId);
        if (clip == null || task == null) {
            return;
        }
        String text = clip.getTag() + (clip.getNote() == null || clip.getNote().isBlank()
                ? "" : " " + clip.getNote());
        try {
            float[] vector = embeddingClient.embed(text);
            vectorStore.upsert(clipId, vector);
            task.setStatus("DONE");
        } catch (Exception e) {
            log.warn("clip {} 向量生成失败：{}", clipId, e.getMessage());
            task.setRetryCount(task.getRetryCount() + 1);
            task.setStatus(task.getRetryCount() >= MAX_RETRY ? "FAILED" : "PENDING");
        }
        task.setUpdatedAt(System.currentTimeMillis());
        taskMapper.updateById(task);
    }

    /** 每 60 秒扫描一次待补任务，按 2^retry 秒指数退避 */
    @Scheduled(fixedDelay = 60_000)
    public void sweep() {
        List<EmbeddingTask> pending;
        try {
            pending = taskMapper.selectPending();
        } catch (Exception e) {
            log.warn("扫描待补向量任务失败：{}", e.getMessage());
            return;
        }
        long now = System.currentTimeMillis();
        for (EmbeddingTask task : pending) {
            long backoffMs = (1L << task.getRetryCount()) * 1_000L;
            if (task.getUpdatedAt() + backoffMs <= now) {
                process(task.getClipId());
            }
        }
    }

    @Override
    public void run(ApplicationArguments args) {
        sweep();
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test -Dtest=EmbeddingTaskServiceTest`
Expected: PASS（Tests run: 5）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: 向量异步生成与指数退避重试"
```

---

### Task 8: InMemoryVectorStore（测试与降级用实现）

**Files:**
- Create: `backend/src/main/java/com/videotagger/service/InMemoryVectorStore.java`
- Test: `backend/src/test/java/com/videotagger/service/InMemoryVectorStoreTest.java`

**Interfaces:**
- Consumes: Task 7 的 `VectorStore`。
- Produces: `InMemoryVectorStore implements VectorStore`（余弦相似度；Task 10 测试使用）。

- [ ] **Step 1: 写失败的测试**

`backend/src/test/java/com/videotagger/service/InMemoryVectorStoreTest.java`：

```java
package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InMemoryVectorStoreTest {

    @Test
    void searchOrdersByCosineDescending() {
        InMemoryVectorStore store = new InMemoryVectorStore();
        store.upsert(1L, new float[]{1f, 0f});     // 与查询同向，相似度 1
        store.upsert(2L, new float[]{0f, 1f});     // 正交，相似度 0
        store.upsert(3L, new float[]{0.6f, 0.8f}); // 相似度 0.6

        List<VectorStore.VectorHit> hits = store.search(new float[]{1f, 0f}, 3);

        assertEquals(List.of(1L, 3L, 2L), hits.stream().map(VectorStore.VectorHit::clipId).toList());
    }

    @Test
    void searchRespectsTopKAndDelete() {
        InMemoryVectorStore store = new InMemoryVectorStore();
        store.upsert(1L, new float[]{1f, 0f});
        store.upsert(2L, new float[]{0.9f, 0.1f});

        assertEquals(1, store.search(new float[]{1f, 0f}, 1).size());

        store.delete(1L);
        List<VectorStore.VectorHit> hits = store.search(new float[]{1f, 0f}, 10);
        assertEquals(1, hits.size());
        assertEquals(2L, hits.get(0).clipId());
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test -Dtest=InMemoryVectorStoreTest`
Expected: 编译失败（`InMemoryVectorStore` 不存在）。

- [ ] **Step 3: 实现**

`backend/src/main/java/com/videotagger/service/InMemoryVectorStore.java`：

```java
package com.videotagger.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryVectorStore implements VectorStore {

    private final Map<Long, float[]> vectors = new ConcurrentHashMap<>();

    @Override
    public void upsert(long clipId, float[] vector) {
        vectors.put(clipId, vector);
    }

    @Override
    public List<VectorHit> search(float[] queryVector, int topK) {
        return vectors.entrySet().stream()
                .map(e -> new VectorHit(e.getKey(), cosine(queryVector, e.getValue())))
                .sorted(Comparator.comparingDouble(VectorHit::score).reversed())
                .limit(topK)
                .toList();
    }

    @Override
    public void delete(long clipId) {
        vectors.remove(clipId);
    }

    private double cosine(float[] a, float[] b) {
        double dot = 0, normA = 0, normB = 0;
        int len = Math.min(a.length, b.length);
        for (int i = 0; i < len; i++) {
            dot += (double) a[i] * b[i];
            normA += (double) a[i] * a[i];
            normB += (double) b[i] * b[i];
        }
        if (normA == 0 || normB == 0) {
            return 0;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test -Dtest=InMemoryVectorStoreTest`
Expected: PASS（Tests run: 2）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: 内存向量存储（余弦相似度）"
```

---

### Task 9: MilvusVectorStore（真实实现，连接失败可降级）

**Files:**
- Create: `backend/src/main/java/com/videotagger/config/MilvusProperties.java`
- Create: `backend/src/main/java/com/videotagger/milvus/MilvusVectorStore.java`

**Interfaces:**
- Consumes: Task 7 的 `VectorStore`；`EmbeddingProperties.dim`。
- Produces: `MilvusVectorStore implements VectorStore`（Spring `@Primary` Bean；连接失败时 `enabled=false`，所有操作静默跳过，应用以关键词模式运行）。

说明：本任务不写自动化测试（规格约定 Milvus 交互以接口隔离、测试用内存实现），验证靠 Step 3 的手动步骤。向量维度不符（换了 Embedding 模型但沿用旧 collection）时，SDK 会在 upsert/search 抛异常——代码捕获后打错误日志并静默跳过，等效于规格的「拒绝向量写入、关键词搜索不受影响」，显式维度校验不做。

- [ ] **Step 1: 实现**

`backend/src/main/java/com/videotagger/config/MilvusProperties.java`：

```java
package com.videotagger.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties("videotagger.milvus")
public class MilvusProperties {
    private String uri = "http://localhost:19530";
    private String collection = "clip_embeddings";
}
```

`backend/src/main/java/com/videotagger/milvus/MilvusVectorStore.java`：

```java
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
                    .metricType(io.milvus.v2.common.IndexParam.MetricType.COSINE)
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
                    .data(List.of(query))
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
```

- [ ] **Step 2: 编译确认**

Run: `mvn -q -f backend/pom.xml compile`
Expected: BUILD SUCCESS

- [ ] **Step 3: 手动验证（连接成功与降级两条路径）**

```powershell
docker compose up -d mysql etcd minio milvus
mvn -f backend/pom.xml spring-boot:run
```

Expected 日志：`Milvus 连接成功，collection=clip_embeddings 就绪`（首次自动建 collection）。
再验证降级：`docker compose stop milvus` 后重启应用，Expected 日志：`Milvus 不可用，应用将以纯关键词模式运行`，且 `/actuator/health` 返回 200。验证后 `docker compose start milvus`。

- [ ] **Step 4: 提交**

```powershell
git add backend/
git commit -m "feat: Milvus 向量存储（失败降级关键词模式）"
```

---

### Task 10: RrfFusion + SearchService（混合召回与降级）

**Files:**
- Create: `backend/src/main/java/com/videotagger/service/RrfFusion.java`
- Create: `backend/src/main/java/com/videotagger/service/SearchResult.java`
- Create: `backend/src/main/java/com/videotagger/service/SearchResponse.java`
- Create: `backend/src/main/java/com/videotagger/service/SearchService.java`
- Create: `backend/src/main/java/com/videotagger/util/UrlTimeParams.java`
- Test: `backend/src/test/java/com/videotagger/service/RrfFusionTest.java`
- Test: `backend/src/test/java/com/videotagger/util/UrlTimeParamsTest.java`
- Test: `backend/src/test/java/com/videotagger/service/SearchServiceTest.java`

**Interfaces:**
- Consumes: `ClipMapper.fullTextSearch`、`EmbeddingClient`、`VectorStore`。
- Produces: `RrfFusion.fuse(int k, List<List<Long>>) -> LinkedHashMap<Long, Double>`；`record SearchResult(Long id, String title, String url, String jumpUrl, Double timestampSec, String tag, String note, Double score)`；`record SearchResponse(boolean semanticEnabled, List<SearchResult> results)`；`SearchService.search(String, int) -> SearchResponse`；`UrlTimeParams.build(String, double) -> String`（Task 11 使用）。

- [ ] **Step 1: 写失败的测试**

`backend/src/test/java/com/videotagger/service/RrfFusionTest.java`：

```java
package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RrfFusionTest {

    @Test
    void itemInBothListsRanksFirst() {
        // id=2 同时出现在两路召回，融合后应排第一
        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(60, List.of(
                List.of(1L, 2L),
                List.of(2L, 3L)
        ));

        assertEquals(List.of(2L, 1L, 3L), List.copyOf(fused.keySet()));
    }

    @Test
    void emptyListsReturnEmpty() {
        assertEquals(0, RrfFusion.fuse(60, List.of(List.of(), List.of())).size());
    }
}
```

`backend/src/test/java/com/videotagger/util/UrlTimeParamsTest.java`：

```java
package com.videotagger.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UrlTimeParamsTest {

    @Test
    void youtubeAppendsTSeconds() {
        assertEquals("https://www.youtube.com/watch?v=abc&t=754s",
                UrlTimeParams.build("https://www.youtube.com/watch?v=abc", 754.5));
    }

    @Test
    void bilibiliAppendsTParam() {
        assertEquals("https://www.bilibili.com/video/BV1xx?t=754",
                UrlTimeParams.build("https://www.bilibili.com/video/BV1xx", 754.5));
    }

    @Test
    void bilibiliWithExistingQueryUsesAmpersand() {
        assertEquals("https://www.bilibili.com/video/BV1xx?p=2&t=754",
                UrlTimeParams.build("https://www.bilibili.com/video/BV1xx?p=2", 754.5));
    }

    @Test
    void otherSitesUnchanged() {
        assertEquals("https://v.example.com/watch/1",
                UrlTimeParams.build("https://v.example.com/watch/1", 754.5));
    }
}
```

`backend/src/test/java/com/videotagger/service/SearchServiceTest.java`：

```java
package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SearchServiceTest {

    ClipMapper clipMapper;
    EmbeddingClient embeddingClient;
    InMemoryVectorStore vectorStore;
    SearchService searchService;

    @BeforeEach
    void setUp() {
        clipMapper = mock(ClipMapper.class);
        embeddingClient = mock(EmbeddingClient.class);
        vectorStore = new InMemoryVectorStore();
        searchService = new SearchService(clipMapper, embeddingClient, vectorStore);
    }

    private Clip clip(long id, String tag) {
        Clip c = new Clip();
        c.setId(id);
        c.setTitle("某动画");
        c.setUrl("https://v.example.com/" + id);
        c.setTimestampSec(60.0);
        c.setTag(tag);
        c.setNote("");
        return c;
    }

    @Test
    void hybridFusesKeywordAndVector() {
        // 关键词召回 [1,2]；向量召回 [2,3] → 融合后 2 第一
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt()))
                .thenReturn(List.of(clip(1L, "战斗A"), clip(2L, "战斗B")));
        when(clipMapper.selectBatchIds(anyCollection()))
                .thenReturn(List.of(clip(1L, "战斗A"), clip(2L, "战斗B"), clip(3L, "战斗C")));
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed("战斗")).thenReturn(new float[]{1f, 0f});
        vectorStore.upsert(2L, new float[]{1f, 0f});
        vectorStore.upsert(3L, new float[]{0.9f, 0.1f});

        SearchResponse resp = searchService.search("战斗", 10);

        assertTrue(resp.semanticEnabled());
        assertEquals(2L, resp.results().get(0).id());
        assertEquals(3, resp.results().size());
    }

    @Test
    void degradesToKeywordWhenNotConfigured() {
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt())).thenReturn(List.of(clip(1L, "战斗A")));
        when(clipMapper.selectBatchIds(anyCollection())).thenReturn(List.of(clip(1L, "战斗A")));
        when(embeddingClient.isConfigured()).thenReturn(false);

        SearchResponse resp = searchService.search("战斗", 10);

        assertFalse(resp.semanticEnabled());
        assertEquals(1, resp.results().size());
    }

    @Test
    void degradesToKeywordWhenEmbedFails() {
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt())).thenReturn(List.of(clip(1L, "战斗A")));
        when(clipMapper.selectBatchIds(anyCollection())).thenReturn(List.of(clip(1L, "战斗A")));
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed(anyString())).thenThrow(new RuntimeException("API 超时"));

        SearchResponse resp = searchService.search("战斗", 10);

        assertFalse(resp.semanticEnabled());
        assertEquals(1, resp.results().size());
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test "-Dtest=RrfFusionTest,UrlTimeParamsTest,SearchServiceTest"`
Expected: 编译失败（被测类不存在）。

- [ ] **Step 3: 实现**

`backend/src/main/java/com/videotagger/service/RrfFusion.java`：

```java
package com.videotagger.service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class RrfFusion {

    private RrfFusion() {
    }

    /** RRF 融合：score = Σ 1/(k + rank)，rank 从 1 开始；返回按分数降序的有序 Map */
    public static LinkedHashMap<Long, Double> fuse(int k, List<List<Long>> rankedLists) {
        Map<Long, Double> scores = new HashMap<>();
        for (List<Long> list : rankedLists) {
            for (int i = 0; i < list.size(); i++) {
                scores.merge(list.get(i), 1.0 / (k + i + 1), Double::sum);
            }
        }
        return scores.entrySet().stream()
                .sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue,
                        (a, b) -> a, LinkedHashMap::new));
    }
}
```

`backend/src/main/java/com/videotagger/util/UrlTimeParams.java`：

```java
package com.videotagger.util;

public final class UrlTimeParams {

    private UrlTimeParams() {
    }

    /** 为支持时间参数的站点拼接回看 URL；其余站点原样返回（由扩展兜底 seek） */
    public static String build(String url, double timestampSec) {
        long seconds = (long) timestampSec;
        if (url.contains("youtube.com/watch")) {
            return url + (url.contains("?") ? "&" : "?") + "t=" + seconds + "s";
        }
        if (url.contains("bilibili.com/video")) {
            return url + (url.contains("?") ? "&" : "?") + "t=" + seconds;
        }
        return url;
    }
}
```

`backend/src/main/java/com/videotagger/service/SearchResult.java`：

```java
package com.videotagger.service;

public record SearchResult(
        Long id,
        String title,
        String url,
        String jumpUrl,
        Double timestampSec,
        String tag,
        String note,
        Double score
) {
}
```

`backend/src/main/java/com/videotagger/service/SearchResponse.java`：

```java
package com.videotagger.service;

import java.util.List;

public record SearchResponse(boolean semanticEnabled, List<SearchResult> results) {
}
```

`backend/src/main/java/com/videotagger/service/SearchService.java`：

```java
package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.util.UrlTimeParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SearchService {

    private static final Logger log = LoggerFactory.getLogger(SearchService.class);
    private static final int RRF_K = 60;

    private final ClipMapper clipMapper;
    private final EmbeddingClient embeddingClient;
    private final VectorStore vectorStore;

    public SearchService(ClipMapper clipMapper, EmbeddingClient embeddingClient, VectorStore vectorStore) {
        this.clipMapper = clipMapper;
        this.embeddingClient = embeddingClient;
        this.vectorStore = vectorStore;
    }

    public SearchResponse search(String query, int limit) {
        List<Long> keywordIds = clipMapper.fullTextSearch(query, limit).stream()
                .map(Clip::getId).toList();

        List<Long> vectorIds = List.of();
        boolean semantic = false;
        if (embeddingClient.isConfigured()) {
            try {
                float[] queryVector = embeddingClient.embed(query);
                vectorIds = vectorStore.search(queryVector, limit).stream()
                        .map(VectorStore.VectorHit::clipId).toList();
                semantic = true;
            } catch (Exception e) {
                log.warn("向量召回失败，降级为关键词搜索：{}", e.getMessage());
            }
        }

        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(RRF_K, List.of(keywordIds, vectorIds));
        List<Long> topIds = fused.keySet().stream().limit(limit).toList();
        if (topIds.isEmpty()) {
            return new SearchResponse(semantic, List.of());
        }

        Map<Long, Clip> byId = clipMapper.selectBatchIds(topIds).stream()
                .collect(Collectors.toMap(Clip::getId, Function.identity()));

        List<SearchResult> results = topIds.stream()
                .filter(byId::containsKey)
                .map(id -> {
                    Clip c = byId.get(id);
                    return new SearchResult(c.getId(), c.getTitle(), c.getUrl(),
                            UrlTimeParams.build(c.getUrl(), c.getTimestampSec()),
                            c.getTimestampSec(), c.getTag(), c.getNote(), fused.get(id));
                })
                .toList();
        return new SearchResponse(semantic, results);
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test "-Dtest=RrfFusionTest,UrlTimeParamsTest,SearchServiceTest"`
Expected: PASS（Tests run: 2 + 4 + 3）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: RRF 融合混合检索与 URL 时间参数拼接"
```

---

### Task 11: SearchController

**Files:**
- Create: `backend/src/main/java/com/videotagger/controller/SearchController.java`
- Test: `backend/src/test/java/com/videotagger/controller/SearchControllerTest.java`

**Interfaces:**
- Consumes: Task 10 的 `SearchService.search`、`SearchResponse`、`SearchResult`。
- Produces: `GET /api/search?q={query}&limit={limit=20}` → `SearchResponse` JSON（Web UI 使用）。

- [ ] **Step 1: 写失败的测试**

`backend/src/test/java/com/videotagger/controller/SearchControllerTest.java`：

```java
package com.videotagger.controller;

import com.videotagger.service.SearchResponse;
import com.videotagger.service.SearchResult;
import com.videotagger.service.SearchService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SearchController.class)
class SearchControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    SearchService searchService;

    @Test
    void searchReturnsResults() throws Exception {
        SearchResult item = new SearchResult(1L, "某动画 第3集",
                "https://www.bilibili.com/video/BV1", "https://www.bilibili.com/video/BV1?t=754",
                754.5, "高燃战斗", "主角觉醒", 0.032);
        Mockito.when(searchService.search(eq("战斗"), eq(20)))
                .thenReturn(new SearchResponse(true, List.of(item)));

        mvc.perform(get("/api/search").param("q", "战斗"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.semanticEnabled").value(true))
                .andExpect(jsonPath("$.results[0].id").value(1))
                .andExpect(jsonPath("$.results[0].jumpUrl").value("https://www.bilibili.com/video/BV1?t=754"))
                .andExpect(jsonPath("$.results[0].tag").value("高燃战斗"));
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test -Dtest=SearchControllerTest`
Expected: 编译失败（`SearchController` 不存在）。

- [ ] **Step 3: 实现**

`backend/src/main/java/com/videotagger/controller/SearchController.java`：

```java
package com.videotagger.controller;

import com.videotagger.service.SearchResponse;
import com.videotagger.service.SearchService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping
    public SearchResponse search(@RequestParam("q") String query,
                                 @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return searchService.search(query, limit);
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test -Dtest=SearchControllerTest`
Expected: PASS（Tests run: 1）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: 搜索接口"
```

---

### Task 12: JumpQueue + JumpController（回看跳转）

**Files:**
- Create: `backend/src/main/java/com/videotagger/service/JumpQueue.java`
- Create: `backend/src/main/java/com/videotagger/controller/JumpController.java`
- Test: `backend/src/test/java/com/videotagger/service/JumpQueueTest.java`
- Test: `backend/src/test/java/com/videotagger/controller/JumpControllerTest.java`

**Interfaces:**
- Produces: `JumpQueue.put(String url, double timestampSec)` / `JumpQueue.poll(String url) -> Optional<Double>`（取出即删、过期失效）；`POST /api/jump {url, timestampSec}`（Web UI 调用）；`GET /api/jump/pending?url={url}` → 200 `{"timestampSec": n}` 或 204（扩展 content.js 调用）。

- [ ] **Step 1: 写失败的测试**

`backend/src/test/java/com/videotagger/service/JumpQueueTest.java`：

```java
package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class JumpQueueTest {

    @Test
    void putThenPollReturnsAndRemoves() {
        JumpQueue queue = new JumpQueue();
        queue.put("https://a.com/v", 123.0);

        Optional<Double> first = queue.poll("https://a.com/v");
        Optional<Double> second = queue.poll("https://a.com/v");

        assertEquals(Optional.of(123.0), first);
        assertTrue(second.isEmpty());
    }

    @Test
    void expiredEntryReturnsEmpty() throws InterruptedException {
        JumpQueue queue = new JumpQueue(50); // 测试用 50ms TTL
        queue.put("https://a.com/v", 123.0);

        Thread.sleep(80);

        assertTrue(queue.poll("https://a.com/v").isEmpty());
    }
}
```

`backend/src/test/java/com/videotagger/controller/JumpControllerTest.java`：

```java
package com.videotagger.controller;

import com.videotagger.service.JumpQueue;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(JumpController.class)
class JumpControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    JumpQueue jumpQueue;

    @Test
    void postJumpPutsIntoQueue() throws Exception {
        mvc.perform(post("/api/jump")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"https://a.com/v\",\"timestampSec\":123.0}"))
                .andExpect(status().isOk());

        Mockito.verify(jumpQueue).put("https://a.com/v", 123.0);
    }

    @Test
    void pendingReturnsTimestampWhenPresent() throws Exception {
        Mockito.when(jumpQueue.poll("https://a.com/v")).thenReturn(Optional.of(123.0));

        mvc.perform(get("/api/jump/pending").param("url", "https://a.com/v"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timestampSec").value(123.0));
    }

    @Test
    void pendingReturns204WhenAbsent() throws Exception {
        Mockito.when(jumpQueue.poll("https://a.com/v")).thenReturn(Optional.empty());

        mvc.perform(get("/api/jump/pending").param("url", "https://a.com/v"))
                .andExpect(status().isNoContent());
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -q -f backend/pom.xml test "-Dtest=JumpQueueTest,JumpControllerTest"`
Expected: 编译失败（`JumpQueue`、`JumpController` 不存在）。

- [ ] **Step 3: 实现**

`backend/src/main/java/com/videotagger/service/JumpQueue.java`：

```java
package com.videotagger.service;

import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class JumpQueue {

    private static final long DEFAULT_TTL_MS = 30_000;

    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();
    private final long ttlMs;

    public JumpQueue() {
        this(DEFAULT_TTL_MS);
    }

    JumpQueue(long ttlMs) {
        this.ttlMs = ttlMs;
    }

    public void put(String url, double timestampSec) {
        entries.put(url, new Entry(timestampSec, System.currentTimeMillis() + ttlMs));
    }

    /** 取出即删；已过期返回空 */
    public Optional<Double> poll(String url) {
        Entry entry = entries.remove(url);
        if (entry == null || entry.expiresAt() < System.currentTimeMillis()) {
            return Optional.empty();
        }
        return Optional.of(entry.timestampSec());
    }

    private record Entry(double timestampSec, long expiresAt) {
    }
}
```

`backend/src/main/java/com/videotagger/controller/JumpController.java`：

```java
package com.videotagger.controller;

import com.videotagger.service.JumpQueue;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/jump")
public class JumpController {

    private final JumpQueue jumpQueue;

    public JumpController(JumpQueue jumpQueue) {
        this.jumpQueue = jumpQueue;
    }

    @PostMapping
    public void jump(@RequestBody JumpRequest req) {
        jumpQueue.put(req.url(), req.timestampSec());
    }

    @GetMapping("/pending")
    public ResponseEntity<Map<String, Double>> pending(@RequestParam("url") String url) {
        Optional<Double> timestamp = jumpQueue.poll(url);
        return timestamp
                .map(t -> ResponseEntity.ok(Map.of("timestampSec", t)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    public record JumpRequest(String url, Double timestampSec) {
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn -q -f backend/pom.xml test "-Dtest=JumpQueueTest,JumpControllerTest"`
Expected: PASS（Tests run: 2 + 3）

- [ ] **Step 5: 提交**

```powershell
git add backend/
git commit -m "feat: 回看跳转队列与接口"
```

---

### Task 13: Web UI（深色卡片风搜索页）

**Files:**
- Create: `backend/src/main/resources/static/index.html`
- Create: `backend/src/main/resources/static/app.css`
- Create: `backend/src/main/resources/static/app.js`

**Interfaces:**
- Consumes: `GET /api/search`（Task 11）、`POST /api/jump`（Task 12）。
- Produces: 浏览器访问 `http://localhost:8080/` 的搜索页。

- [ ] **Step 1: 实现**

`backend/src/main/resources/static/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Tagger</title>
    <link rel="stylesheet" href="app.css">
</head>
<body>
<main class="container">
    <h1 class="logo">Video Tagger</h1>
    <form id="search-form" class="search-box">
        <input id="search-input" type="text" placeholder="用自然语言描述你想找的片段，如「主角爆种的战斗场面」"
               autocomplete="off" autofocus>
        <button type="button" id="clear-btn" title="清空">&times;</button>
    </form>
    <div id="semantic-hint" class="semantic-hint" hidden>语义搜索未启用（未配置 Embedding API），当前为关键词搜索</div>
    <div id="status" class="status"></div>
    <section id="results" class="results"></section>
</main>
<script src="app.js"></script>
</body>
</html>
```

`backend/src/main/resources/static/app.css`：

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    background: #1e1e2e;
    color: #cdd6f4;
    font-family: "Microsoft YaHei UI", system-ui, sans-serif;
    min-height: 100vh;
}

.container { max-width: 760px; margin: 0 auto; padding: 48px 20px; }

.logo {
    font-size: 22px;
    font-weight: 600;
    color: #cba6f7;
    margin-bottom: 20px;
    letter-spacing: 1px;
}

.search-box {
    display: flex;
    align-items: center;
    background: #313244;
    border: 1px solid #45475a;
    border-radius: 12px;
    padding: 4px 8px 4px 18px;
    transition: border-color .15s;
}
.search-box:focus-within { border-color: #cba6f7; }

#search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #cdd6f4;
    font-size: 16px;
    padding: 12px 0;
}
#search-input::placeholder { color: #6c7086; }

#clear-btn {
    background: transparent;
    border: none;
    color: #6c7086;
    font-size: 20px;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 8px;
}
#clear-btn:hover { color: #cdd6f4; background: #45475a; }

.semantic-hint {
    margin-top: 12px;
    font-size: 13px;
    color: #f9e2af;
    background: rgba(249, 226, 175, .08);
    border: 1px solid rgba(249, 226, 175, .25);
    border-radius: 8px;
    padding: 8px 12px;
}

.status { margin-top: 14px; font-size: 13px; color: #6c7086; min-height: 18px; }

.results { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; }

.card {
    background: #313244;
    border: 1px solid #45475a;
    border-radius: 12px;
    padding: 16px 18px;
    cursor: pointer;
    transition: transform .15s, border-color .15s;
    animation: fadeIn .15s ease-out;
}
.card:hover { transform: translateY(-2px); border-color: #cba6f7; }

.card-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }

.badge-time {
    display: inline-block;
    background: rgba(203, 166, 247, .15);
    color: #cba6f7;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    padding: 2px 8px;
    margin-right: 8px;
    font-variant-numeric: tabular-nums;
}

.card-tag { font-size: 14px; color: #a6e3a1; }
.card-note { font-size: 13px; color: #7f849c; margin-top: 6px; }

.score-bar { margin-top: 10px; height: 3px; background: #45475a; border-radius: 2px; overflow: hidden; }
.score-bar > div { height: 100%; background: #cba6f7; border-radius: 2px; }

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}
```

`backend/src/main/resources/static/app.js`：

```javascript
const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const semanticHint = document.getElementById('semantic-hint');

function fmtTime(sec) {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

async function doSearch(e) {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    statusEl.textContent = '搜索中…';
    resultsEl.innerHTML = '';
    try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        semanticHint.hidden = data.semanticEnabled;
        renderResults(data.results);
        statusEl.textContent = data.results.length ? `共 ${data.results.length} 条结果` : '没有找到相关片段';
    } catch (err) {
        statusEl.textContent = '搜索失败：后端未响应，请确认服务已启动';
    }
}

function renderResults(results) {
    const maxScore = Math.max(...results.map(r => r.score), 0.0001);
    for (const r of results) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-title"></div>
            <div>
                <span class="badge-time">${fmtTime(r.timestampSec)}</span>
                <span class="card-tag"></span>
            </div>
            <div class="score-bar"><div style="width:${Math.round(r.score / maxScore * 100)}%"></div></div>`;
        card.querySelector('.card-title').textContent = r.title;
        card.querySelector('.card-tag').textContent = r.tag + (r.note ? ` · ${r.note}` : '');
        card.addEventListener('click', () => jump(r));
        resultsEl.appendChild(card);
    }
}

async function jump(r) {
    try {
        await fetch('/api/jump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: r.url, timestampSec: r.timestampSec })
        });
    } catch (err) { /* 跳转队列失败不阻塞打开页面 */ }
    window.open(r.jumpUrl, '_blank');
}

form.addEventListener('submit', doSearch);
clearBtn.addEventListener('click', () => { input.value = ''; resultsEl.innerHTML = ''; statusEl.textContent = ''; input.focus(); });
```

- [ ] **Step 2: 手动验证**

```powershell
docker compose up -d mysql
mvn -f backend/pom.xml spring-boot:run
```

另开终端写入测试数据：

```powershell
curl -X POST http://localhost:8080/api/clips -H "Content-Type: application/json" -d '{\"title\":\"某动画 第3集\",\"url\":\"https://www.bilibili.com/video/BV1xx\",\"timestampSec\":754.5,\"tag\":\"高燃战斗\",\"note\":\"主角觉醒\"}'
```

浏览器打开 `http://localhost:8080/`，搜索「战斗」，Expected：卡片展示片名、`12:34` 时间徽章、标签；因未配置 Embedding API，顶部出现「语义搜索未启用」提示；点击卡片打开新标签页。

- [ ] **Step 3: 提交**

```powershell
git add backend/
git commit -m "feat: 深色卡片风 Web 搜索页"
```

---

### Task 14: 浏览器扩展 —— 抓取与保存链路

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/background.js`
- Create: `extension/content.js`
- Create: `extension/options.html`
- Create: `extension/options.js`

**Interfaces:**
- Consumes: `POST /api/clips`（Task 4）。
- Produces: `Alt+S` → 页面内浮层（本任务为朴素样式，Task 15 美化）→ 保存到后端；`chrome.storage.sync` 键 `backendBaseUrl`（默认 `http://localhost:8080`）；content.js 向 background 发送的消息格式 `{type: "save-clip", payload: {title, url, timestampSec, tag, note}}`、`{type: "notify", message: string}`。

- [ ] **Step 1: 实现**

`extension/manifest.json`：

```json
{
  "manifest_version": 3,
  "name": "Video Tagger",
  "version": "0.1.0",
  "description": "网页视频片段打标签与回看",
  "permissions": ["commands", "storage", "notifications"],
  "host_permissions": ["http://localhost:8080/*", "http://127.0.0.1:8080/*"],
  "background": { "service_worker": "background.js" },
  "commands": {
    "tag-clip": {
      "suggested_key": { "default": "Alt+S" },
      "description": "标记当前视频片段"
    }
  },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["content.js"],
      "all_frames": false
    }
  ],
  "options_page": "options.html"
}
```

`extension/background.js`：

```javascript
const DEFAULT_BACKEND = 'http://localhost:8080';

async function getBackendBase() {
  const { backendBaseUrl } = await chrome.storage.sync.get('backendBaseUrl');
  return backendBaseUrl || DEFAULT_BACKEND;
}

function notify(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'Video Tagger',
    message
  });
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'tag-clip') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const info = await chrome.tabs.sendMessage(tab.id, { type: 'grab-video' });
    if (!info || info.error) {
      notify(info && info.error === 'no-video' ? '当前页面没有找到视频' : '该页面不支持抓取');
      return;
    }
    await chrome.tabs.sendMessage(tab.id, { type: 'show-overlay', info });
  } catch (e) {
    notify('该页面不支持打标签（无法注入脚本）');
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'save-clip') {
    (async () => {
      const base = await getBackendBase();
      try {
        const resp = await fetch(`${base}/api/clips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        sendResponse({ ok: true });
      } catch (e) {
        notify('保存失败：后端未启动？请先执行 docker compose up -d');
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true; // 异步 sendResponse
  }
  if (msg.type === 'notify') {
    notify(msg.message);
    return false;
  }
});
```

`extension/content.js`（本任务版本：抓取 + 朴素浮层；Task 15 替换为 Shadow DOM 美化版）：

```javascript
(function () {
  if (window.__videoTaggerLoaded) return;
  window.__videoTaggerLoaded = true;

  function findVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    return videos.find(v => !v.paused) || videos[0];
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'grab-video') {
      const video = findVideo();
      if (!video) {
        sendResponse({ error: 'no-video' });
        return false;
      }
      sendResponse({
        title: document.title,
        url: location.href,
        timestampSec: video.currentTime
      });
      return false;
    }
    if (msg.type === 'show-overlay') {
      showOverlay(msg.info);
      return false;
    }
  });

  function showOverlay(info) {
    document.getElementById('vt-overlay-root')?.remove();

    const root = document.createElement('div');
    root.id = 'vt-overlay-root';
    root.style.cssText = 'position:fixed;top:24px;right:24px;z-index:2147483647;' +
      'background:#1e1e2e;color:#cdd6f4;border-radius:12px;padding:16px;width:320px;' +
      'font:14px "Microsoft YaHei UI",sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5);' +
      'border:1px solid #45475a;';

    root.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px;color:#cba6f7">标记片段</div>
      <div style="font-size:12px;color:#7f849c;margin-bottom:8px;word-break:break-all" id="vt-meta"></div>
      <input id="vt-tag" placeholder="标签，如：高燃战斗" style="width:100%;box-sizing:border-box;
        background:#313244;border:1px solid #45475a;border-radius:8px;color:#cdd6f4;
        padding:8px 10px;margin-bottom:8px;outline:none">
      <input id="vt-note" placeholder="备注（可选）" style="width:100%;box-sizing:border-box;
        background:#313244;border:1px solid #45475a;border-radius:8px;color:#cdd6f4;
        padding:8px 10px;margin-bottom:10px;outline:none">
      <div style="text-align:right">
        <button id="vt-cancel" style="background:transparent;border:1px solid #45475a;color:#cdd6f4;
          border-radius:8px;padding:6px 14px;margin-right:8px;cursor:pointer">取消</button>
        <button id="vt-save" style="background:#cba6f7;border:none;color:#1e1e2e;font-weight:600;
          border-radius:8px;padding:6px 14px;cursor:pointer">保存</button>
      </div>`;

    root.querySelector('#vt-meta').textContent =
      `${info.title} · ${Math.floor(info.timestampSec / 60)}:${String(Math.floor(info.timestampSec % 60)).padStart(2, '0')}`;
    document.body.appendChild(root);

    const tagInput = root.querySelector('#vt-tag');
    tagInput.focus();

    function close() { root.remove(); }

    async function save() {
      const tag = tagInput.value.trim();
      if (!tag) { tagInput.style.borderColor = '#f38ba8'; return; }
      const resp = await chrome.runtime.sendMessage({
        type: 'save-clip',
        payload: {
          title: info.title,
          url: info.url,
          timestampSec: info.timestampSec,
          tag,
          note: root.querySelector('#vt-note').value.trim()
        }
      });
      if (resp && resp.ok) close();
    }

    root.querySelector('#vt-save').addEventListener('click', save);
    root.querySelector('#vt-cancel').addEventListener('click', close);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') close();
      e.stopPropagation();
    });
  }
})();
```

`extension/options.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Video Tagger 设置</title>
  <style>
    body { font-family: "Microsoft YaHei UI", sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
    label { display: block; margin-bottom: 8px; font-weight: 600; }
    input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #ccc; border-radius: 8px; }
    button { margin-top: 16px; padding: 8px 20px; border: none; border-radius: 8px; background: #7c5cbf; color: #fff; cursor: pointer; }
    #status { margin-top: 12px; color: green; font-size: 13px; }
  </style>
</head>
<body>
  <h2>Video Tagger 设置</h2>
  <label for="backend">后端地址</label>
  <input id="backend" placeholder="http://localhost:8080">
  <button id="save">保存</button>
  <div id="status"></div>
  <script src="options.js"></script>
</body>
</html>
```

`extension/options.js`：

```javascript
const input = document.getElementById('backend');
const status = document.getElementById('status');

chrome.storage.sync.get('backendBaseUrl', ({ backendBaseUrl }) => {
  input.value = backendBaseUrl || 'http://localhost:8080';
});

document.getElementById('save').addEventListener('click', () => {
  chrome.storage.sync.set({ backendBaseUrl: input.value.trim() }, () => {
    status.textContent = '已保存';
    setTimeout(() => { status.textContent = ''; }, 1500);
  });
});
```

说明：`manifest.json` 引用的 `icon128.png` 用任意 128×128 PNG 占位即可（扩展加载不强制校验图标文件存在，缺失时通知不显示图标，不影响功能；正式图标留待后续美化）。

- [ ] **Step 2: 手动验证**

1. 后端启动（`docker compose up -d mysql` + `mvn -f backend/pom.xml spring-boot:run`）。
2. Chrome 打开 `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选择 `extension/`。
3. 打开 B站任意视频播放，按 `Alt+S`，Expected：右上角浮层显示片名与当前进度；输入标签保存。
4. 验证数据落库：`curl "http://localhost:8080/api/search?q=你的标签"` 能搜到该片段。
5. 停掉后端再按 `Alt+S` 保存，Expected：浏览器通知「保存失败：后端未启动…」。

- [ ] **Step 3: 提交**

```powershell
git add extension/
git commit -m "feat: 浏览器扩展抓取与保存链路"
```

---

### Task 15: 扩展浮层美化（Shadow DOM + 磨砂卡片）

**Files:**
- Modify: `extension/content.js`（浮层部分全量重写为 Shadow DOM 版）

**Interfaces:**
- Consumes: Task 14 的消息协议不变（`show-overlay` / `save-clip`）。
- Produces: 同 Task 14，仅 UI 升级。

- [ ] **Step 1: 重写 content.js 的浮层实现**

`extension/content.js`（全量替换）：

```javascript
(function () {
  if (window.__videoTaggerLoaded) return;
  window.__videoTaggerLoaded = true;

  function findVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    return videos.find(v => !v.paused) || videos[0];
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'grab-video') {
      const video = findVideo();
      if (!video) {
        sendResponse({ error: 'no-video' });
        return false;
      }
      sendResponse({
        title: document.title,
        url: location.href,
        timestampSec: video.currentTime
      });
      return false;
    }
    if (msg.type === 'show-overlay') {
      showOverlay(msg.info);
      return false;
    }
  });

  const OVERLAY_CSS = `
    :host { all: initial; }
    .card {
      position: fixed; top: 24px; right: 24px; z-index: 2147483647;
      width: 340px; padding: 18px;
      background: rgba(30, 30, 46, 0.92);
      backdrop-filter: blur(12px);
      border: 1px solid #45475a; border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
      color: #cdd6f4; font: 14px "Microsoft YaHei UI", system-ui, sans-serif;
      animation: slideIn .18s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .card.closing { opacity: 0; transform: translateX(20px); transition: all .15s ease-in; }
    h3 { margin: 0 0 10px; font-size: 15px; color: #cba6f7; font-weight: 600; }
    .meta { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .badge {
      font-size: 12px; background: #313244; border: 1px solid #45475a;
      border-radius: 6px; padding: 3px 8px; color: #a6adc8;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      cursor: text;
    }
    .badge.time { color: #cba6f7; font-variant-numeric: tabular-nums; }
    input {
      width: 100%; box-sizing: border-box; margin-bottom: 10px;
      background: #313244; border: 1px solid #45475a; border-radius: 8px;
      color: #cdd6f4; padding: 9px 12px; font-size: 14px; outline: none;
      font-family: inherit;
    }
    input:focus { border-color: #cba6f7; }
    input.error { border-color: #f38ba8; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    button {
      border-radius: 8px; padding: 7px 16px; font-size: 13px; cursor: pointer;
      font-family: inherit;
    }
    .cancel { background: transparent; border: 1px solid #45475a; color: #cdd6f4; }
    .cancel:hover { background: #313244; }
    .save { background: #cba6f7; border: none; color: #1e1e2e; font-weight: 600; }
    .save:hover { background: #b695e8; }
    .toast {
      margin-top: 10px; font-size: 12px; color: #a6e3a1; text-align: right;
      opacity: 0; transition: opacity .2s;
    }
    .toast.show { opacity: 1; }
  `;

  function fmtTime(sec) {
    const s = Math.floor(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function showOverlay(info) {
    document.getElementById('vt-overlay-host')?.remove();

    const host = document.createElement('div');
    host.id = 'vt-overlay-host';
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>${OVERLAY_CSS}</style>
      <div class="card">
        <h3>标记片段</h3>
        <div class="meta">
          <span class="badge" id="vt-title" contenteditable="true" title="点击可编辑"></span>
          <span class="badge time" id="vt-time" contenteditable="true" title="点击可编辑（秒）"></span>
        </div>
        <input id="vt-tag" placeholder="标签，如：高燃战斗" autocomplete="off">
        <input id="vt-note" placeholder="备注（可选）" autocomplete="off">
        <div class="actions">
          <button class="cancel" id="vt-cancel">取消</button>
          <button class="save" id="vt-save">保存 (Enter)</button>
        </div>
        <div class="toast" id="vt-toast">已保存</div>
      </div>`;

    const titleEl = shadow.getElementById('vt-title');
    const timeEl = shadow.getElementById('vt-time');
    titleEl.textContent = info.title;
    timeEl.textContent = String(Math.round(info.timestampSec));
    timeEl.title = `点击可编辑（秒）· 当前 ${fmtTime(info.timestampSec)}`;

    document.body.appendChild(host);

    const card = shadow.querySelector('.card');
    const tagInput = shadow.getElementById('vt-tag');
    const noteInput = shadow.getElementById('vt-note');
    tagInput.focus();

    function close() {
      card.classList.add('closing');
      setTimeout(() => host.remove(), 150);
    }

    async function save() {
      const tag = tagInput.value.trim();
      if (!tag) {
        tagInput.classList.add('error');
        tagInput.focus();
        return;
      }
      const editedSec = parseFloat(timeEl.textContent);
      const resp = await chrome.runtime.sendMessage({
        type: 'save-clip',
        payload: {
          title: titleEl.textContent.trim() || info.title,
          url: info.url,
          timestampSec: Number.isFinite(editedSec) ? editedSec : info.timestampSec,
          tag,
          note: noteInput.value.trim()
        }
      });
      if (resp && resp.ok) {
        shadow.getElementById('vt-toast').classList.add('show');
        setTimeout(close, 400);
      }
    }

    shadow.getElementById('vt-save').addEventListener('click', save);
    shadow.getElementById('vt-cancel').addEventListener('click', close);
    card.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && e.target.id !== 'vt-title') save();
      if (e.key === 'Escape') close();
    });
  }
})();
```

- [ ] **Step 2: 手动验证**

`chrome://extensions` 中对扩展点「重新加载」，刷新视频页按 `Alt+S`，Expected：浮层右上角滑入、磨砂背景、片名/时间戳徽章可点击编辑；`Enter` 保存后显示「已保存」并淡出；`Esc` 取消。

- [ ] **Step 3: 提交**

```powershell
git add extension/
git commit -m "feat: 打标签浮层 Shadow DOM 美化"
```

---

### Task 16: 扩展回看 seek（页面加载后自动定位）

**Files:**
- Modify: `extension/content.js`（追加回看轮询逻辑）

**Interfaces:**
- Consumes: `GET /api/jump/pending?url={url}`（Task 12）；`chrome.storage.sync` 的 `backendBaseUrl`（Task 14）。

- [ ] **Step 1: 修改 content.js**

`extension/content.js`（全量替换 = Task 15 版本 + 末尾 IIFE 内追加回看逻辑）：

在 Task 15 版本的 `showOverlay` 函数之后、IIFE 结束 `})();` 之前，追加以下代码（其余部分保持不变）：

```javascript
  // ===== 回看 seek：页面加载后轮询后端「待跳转」标记 =====

  const VT_DEFAULT_BACKEND = 'http://localhost:8080';

  /** 去掉 URL 中的时间参数，与后端待跳转队列的 key 对齐 */
  function normalizeUrl(url) {
    return url.replace(/([?&])t=\d+s?(&|$)/g, (m, p1, p2) => (p2 === '&' ? p1 : ''))
              .replace(/[?&]$/, '');
  }

  async function getBackendBase() {
    const { backendBaseUrl } = await chrome.storage.sync.get('backendBaseUrl');
    return backendBaseUrl || VT_DEFAULT_BACKEND;
  }

  function seekWhenReady(video, timestampSec) {
    if (video.readyState >= 1) {
      video.currentTime = timestampSec;
    } else {
      video.addEventListener('loadedmetadata', () => { video.currentTime = timestampSec; }, { once: true });
    }
  }

  async function trySeek() {
    const video = findVideo();
    if (!video) return;
    try {
      const base = await getBackendBase();
      const url = normalizeUrl(location.href);
      const resp = await fetch(`${base}/api/jump/pending?url=${encodeURIComponent(url)}`);
      if (!resp.ok) return; // 204 或后端未启动
      const data = await resp.json();
      if (typeof data.timestampSec === 'number') {
        seekWhenReady(video, data.timestampSec);
      }
    } catch (e) { /* 后端未启动，静默 */ }
  }

  // 视频元素可能延迟出现：加载后 0s / 2s / 5s 各试一次
  trySeek();
  setTimeout(trySeek, 2_000);
  setTimeout(trySeek, 5_000);
```

注意：`normalizeUrl` 是必须的——YouTube/B站的 `jumpUrl` 带 `t` 参数，页面地址与队列 key（原始 url）不一致会导致查不到标记。

- [ ] **Step 2: 手动验证**

1. 重载扩展。
2. 在 Web UI 搜索并点击一条 B站结果，Expected：新标签页打开 `…?t=754` 并自动定位到 12:34（URL 参数本身生效，扩展轮询作为二次确认）。
3. 找一条**非** B站/YouTube 的普通 HTML5 视频页标签记录（可先用 curl 手工造一条：`curl -X POST http://localhost:8080/api/clips -H "Content-Type: application/json" -d '{"title":"测试","url":"https://某测试页","timestampSec":30,"tag":"测试"}'`），点击结果，Expected：页面打开后约 0~5 秒内视频自动跳到 30 秒。
4. 再次刷新该页，Expected：不再 seek（标记已消费）。

- [ ] **Step 3: 提交**

```powershell
git add extension/
git commit -m "feat: 扩展回看自动 seek"
```

---

### Task 17: Dockerfile + 完整 docker-compose 一键部署

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Modify: `docker-compose.yml`（追加 `app` 服务）
- Create: `.env.example`
- Create: `README.md`

**Interfaces:**
- Produces: `docker compose up -d` 一条命令起全栈；`http://localhost:8080` 可用。

- [ ] **Step 1: 实现**

`backend/Dockerfile`：

```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/video-tagger-backend-0.1.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

`backend/.dockerignore`：

```
target/
```

`docker-compose.yml`（全量替换 = 原基础设施 + 追加 app 服务；基础设施部分保持 Task 2 内容不变，以下为完整文件）：

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: vt-mysql
    environment:
      MYSQL_ROOT_PASSWORD: root123456
      MYSQL_DATABASE: video_tagger
      TZ: Asia/Shanghai
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot123456"]
      interval: 5s
      timeout: 3s
      retries: 20

  etcd:
    image: quay.io/coreos/etcd:v3.5.14
    container_name: vt-etcd
    environment:
      ETCD_AUTO_COMPACTION_MODE: revision
      ETCD_AUTO_COMPACTION_RETENTION: "1000"
      ETCD_QUOTA_BACKEND_BYTES: "4294967296"
      ETCD_SNAPSHOT_COUNT: "50000"
    volumes:
      - etcd_data:/etcd
    command: etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd

  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    container_name: vt-minio
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - minio_data:/minio_data
    command: minio server /minio_data --console-address ":9001"

  milvus:
    image: milvusdb/milvus:v2.4.13
    container_name: vt-milvus
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    ports:
      - "19530:19530"
    volumes:
      - milvus_data:/var/lib/milvus
    depends_on:
      - etcd
      - minio

  app:
    build: ./backend
    container_name: vt-app
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/video_tagger?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false
      MYSQL_ROOT_PASSWORD: root123456
      MILVUS_URI: http://milvus:19530
      EMBEDDING_BASE_URL: ${EMBEDDING_BASE_URL:-}
      EMBEDDING_API_KEY: ${EMBEDDING_API_KEY:-}
      EMBEDDING_MODEL: ${EMBEDDING_MODEL:-text-embedding-3-small}
      EMBEDDING_DIM: ${EMBEDDING_DIM:-1024}
    depends_on:
      mysql:
        condition: service_healthy
      milvus:
        condition: service_started

volumes:
  mysql_data:
  etcd_data:
  minio_data:
  milvus_data:
```

说明：mysql 的 `3306` 与 milvus 的 `19530` 端口映射保留（本地 `mvn spring-boot:run` 开发直连同一套基础设施，排障也方便）；单机使用场景下可接受。

`.env.example`：

```
# Embedding API（OpenAI 兼容，可选；留空则降级为纯关键词搜索）
EMBEDDING_BASE_URL=
EMBEDDING_API_KEY=
EMBEDDING_MODEL=
EMBEDDING_DIM=1024
```

`README.md`：

```markdown
# Video Tagger

网页视频片段打标签 + 自然语言搜索 + 一键回看的本地工具。

## 快速开始

前置：Docker Desktop（Windows）。

```powershell
git clone <repo> video-tagger
cd video-tagger
copy .env.example .env   # 可选：填入 Embedding API 配置以启用语义搜索
docker compose up -d
```

1. 浏览器 `chrome://extensions` → 开发者模式 → 加载已解压扩展 → 选择 `extension/` 目录。
2. 打开 `http://localhost:8080` 进入搜索页。
3. 看视频时按 `Alt+S` 打标签；在搜索页用自然语言检索，点击结果自动跳转到对应片段。

## 常用命令

```powershell
docker compose up -d        # 启动全栈
docker compose down         # 停止（数据保留在卷中）
docker compose logs -f app  # 查看后端日志
```

## 开发

```powershell
docker compose up -d mysql etcd minio milvus   # 仅起基础设施
mvn -f backend/pom.xml spring-boot:run         # 本地跑后端
mvn -f backend/pom.xml test                    # 跑测试（需 Docker 运行中，Testcontainers）
```
```

- [ ] **Step 2: 全栈构建与启动**

```powershell
docker compose build app
docker compose up -d
docker compose ps
```

Expected：5 个容器全部 Up；`docker compose logs app` 中出现 `Milvus 连接成功`。

- [ ] **Step 3: 端到端验证**

1. `curl http://localhost:8080/actuator/health` → `{"status":"UP"}`。
2. 打开 `http://localhost:8080`，搜索此前保存的标签，Expected：结果正常展示。
3. 点击结果，Expected：浏览器打开视频页并自动 seek。
4. `docker compose down` 后 `docker compose up -d`，Expected：数据仍在（卷持久化）。

- [ ] **Step 4: 提交**

```powershell
git add backend/Dockerfile backend/.dockerignore docker-compose.yml .env.example README.md
git commit -m "feat: Dockerfile 与 docker-compose 一键部署"
```

---

## 收尾

全部任务完成后：

```powershell
mvn -q -f backend/pom.xml test   # 全量测试回归
```

Expected：全部 PASS。随后按 `finishing-a-development-branch` 技能决定合并/收尾方式。

### 已知后续迭代（本计划不做）

- 删除标签功能：规格仅在双写一致性章节提及删除顺序（先 MySQL 后 Milvus），无 UI 入口；`VectorStore.delete` 已在接口中预留，后续加 `DELETE /api/clips/{id}` 与 Web UI 删除按钮即可。
