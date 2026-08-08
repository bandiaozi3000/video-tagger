package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * omofuna 同步任务编排：内存任务表 + @Async(syncExecutor) 跑 {@code node omofuna.js} 抓取并导入。
 *
 * 抓取 486 页约 20~40 分钟，不能同步阻塞 HTTP——POST 立即返回 taskId，前端轮询 {@link #get} 进度。
 * 任务存内存 ConcurrentHashMap（不持久化，重启丢失可接受：个人工具 + GET /current 刷新恢复 + 提示文案兜底）。
 * 进度信号：node stdout 每页一行 {@code [omofuna] page=... total=N}，reader 线程正则解析。
 */
@Service
public class OmofunaSyncTaskService {

    private static final Logger log = LoggerFactory.getLogger(OmofunaSyncTaskService.class);
    private static final long TIMEOUT_SECONDS = 60 * 60; // 抓取总超时
    private static final int MAX_TASKS = 5; // 任务表容量，超出淘汰最旧非 RUNNING
    private static final int MIN_YEAR = 2000;
    private static final int MAX_YEAR = 2026;
    private static final Pattern PROGRESS = Pattern.compile("\\[omofuna\\] page=\\d+/\\d+/\\d+ items=\\d+ total=(\\d+)");

    /** 同步任务快照（不可变）。status: RUNNING / DONE / ERROR。types 为抓取分类过滤（空=全部）。 */
    public record OmofunaTask(String taskId, String status, List<Integer> years, List<Integer> types,
                              int processedPages, int itemsFound, int added, int skipped,
                              String message, long createdAt, long updatedAt) {
    }

    private final OmofunaSyncService omofunaSyncService;
    private final String scriptsDir;
    private final String nodePath;
    private final String chromePath;
    private final Map<String, OmofunaTask> tasks = new ConcurrentHashMap<>();

    public OmofunaSyncTaskService(OmofunaSyncService omofunaSyncService,
                                  @Value("${videotagger.render.scripts-dir}") String scriptsDir,
                                  @Value("${videotagger.render.node-path}") String nodePath,
                                  @Value("${videotagger.render.chrome-path}") String chromePath) {
        this.omofunaSyncService = omofunaSyncService;
        this.scriptsDir = scriptsDir;
        this.nodePath = nodePath;
        this.chromePath = chromePath;
    }

    /** 校验并创建 RUNNING 任务；已有 RUNNING 抛异常（→400）。types 为空 = 全部类目。 */
    public OmofunaTask create(List<Integer> years, List<Integer> types) {
        if (years == null || years.isEmpty()) {
            throw new IllegalArgumentException("请至少勾选一个年份");
        }
        for (Integer y : years) {
            if (y == null || y < MIN_YEAR || y > MAX_YEAR) {
                throw new IllegalArgumentException("年份超出 " + MIN_YEAR + "~" + MAX_YEAR + "：" + y);
            }
        }
        boolean running = tasks.values().stream().anyMatch(t -> "RUNNING".equals(t.status()));
        if (running) {
            throw new IllegalArgumentException("已有 omofuna 同步任务进行中，请等待完成");
        }
        String taskId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        long now = System.currentTimeMillis();
        OmofunaTask t = new OmofunaTask(taskId, "RUNNING", List.copyOf(years),
                types == null ? List.of() : List.copyOf(types),
                0, 0, 0, 0, "", now, now);
        tasks.put(taskId, t);
        evict();
        return t;
    }

    /** @Async 执行抓取+导入（由 controller 经代理调用，避开自调用失效）。 */
    @Async("syncExecutor")
    public void execute(String taskId, List<Integer> years, List<Integer> types) {
        Path work = null;
        try {
            work = Files.createTempDirectory("vt-omofuna-");
            Path out = work.resolve("omofuna.json");
            String yearsArg = years.stream().map(String::valueOf).collect(Collectors.joining(","));
            var cmd = new java.util.ArrayList<String>();
            cmd.add(nodePath);
            cmd.add("omofuna.js");
            cmd.add("--years");
            cmd.add(yearsArg);
            cmd.add("--out");
            cmd.add(out.toAbsolutePath().toString());
            cmd.add("--chrome");
            cmd.add(chromePath);
            if (types != null && !types.isEmpty()) {
                cmd.add("--types");
                cmd.add(types.stream().map(String::valueOf).collect(Collectors.joining(",")));
            }
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(resolveScriptsDir().toFile());
            pb.redirectErrorStream(true);

            log.info("启动 omofuna 抓取: {} 年, 产物 {}", years, out);
            long t0 = System.currentTimeMillis();
            Process p = pb.start();

            // reader 线程：逐行读 stdout 解析进度（先 drain 防管道 64KB 写满死锁）
            Thread reader = new Thread(() -> {
                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        Matcher m = PROGRESS.matcher(line);
                        if (m.find()) {
                            updateProgress(taskId, Integer.parseInt(m.group(1)));
                        }
                    }
                } catch (IOException e) {
                    // reader 线程退出即可，主线程按退出码判定
                }
            }, "omofuna-reader-" + taskId);
            reader.setDaemon(true);
            reader.start();

            boolean finished = p.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                p.destroyForcibly();
                complete(taskId, "ERROR", "抓取超时（>" + TIMEOUT_SECONDS + "s），已强制终止");
                return;
            }
            if (p.exitValue() != 0) {
                complete(taskId, "ERROR", "抓取失败（node 退出 " + p.exitValue() + "），见后端日志");
                return;
            }
            if (!Files.exists(out)) {
                complete(taskId, "ERROR", "抓取产物缺失");
                return;
            }
            OmofunaSyncService.SyncResult r = omofunaSyncService.importFromJson(out);
            complete(taskId, "DONE", "");
            tasks.computeIfPresent(taskId, (k, t) -> new OmofunaTask(t.taskId(), "DONE", t.years(), t.types(),
                    t.processedPages(), t.itemsFound(), r.added(), r.skipped(), "", t.createdAt(),
                    System.currentTimeMillis()));
            log.info("omofuna 同步完成（{}s）：新增 {}，跳过 {}", (System.currentTimeMillis() - t0) / 1000,
                    r.added(), r.skipped());
        } catch (Exception e) {
            complete(taskId, "ERROR", e.getMessage() == null ? String.valueOf(e) : e.getMessage());
        } finally {
            if (work != null) {
                try {
                    try (var s = Files.walk(work)) {
                        s.sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                            try {
                                Files.deleteIfExists(p);
                            } catch (IOException ignored) {
                            }
                        });
                    }
                } catch (IOException ignored) {
                    // 临时目录由 OS 兜底清理
                }
            }
        }
    }

    /** 取任务状态；不存在返回 null（controller 转 404）。 */
    public OmofunaTask get(String taskId) {
        return tasks.get(taskId);
    }

    /** 最近一次任务（前端刷新恢复）：RUNNING 续轮询 / DONE·ERROR 展示结果 / null 全新。 */
    public OmofunaTask current() {
        return tasks.values().stream()
                .max(java.util.Comparator.comparingLong(OmofunaTask::createdAt))
                .orElse(null);
    }

    private void updateProgress(String taskId, int itemsFound) {
        tasks.computeIfPresent(taskId, (k, t) -> new OmofunaTask(t.taskId(), t.status(), t.years(), t.types(),
                t.processedPages() + 1, Math.max(t.itemsFound(), itemsFound),
                t.added(), t.skipped(), t.message(), t.createdAt(), System.currentTimeMillis()));
    }

    private void complete(String taskId, String status, String message) {
        tasks.computeIfPresent(taskId, (k, t) -> new OmofunaTask(t.taskId(), status, t.years(), t.types(),
                t.processedPages(), t.itemsFound(), t.added(), t.skipped(), message, t.createdAt(),
                System.currentTimeMillis()));
    }

    /** 容量超限时淘汰最旧的非 RUNNING 任务。 */
    private void evict() {
        if (tasks.size() <= MAX_TASKS) {
            return;
        }
        tasks.values().stream()
                .filter(t -> !"RUNNING".equals(t.status()))
                .min(java.util.Comparator.comparingLong(OmofunaTask::createdAt))
                .ifPresent(oldest -> tasks.remove(oldest.taskId()));
    }

    /**
     * 定位 omofuna.js 所在目录。配置值相对应用工作目录（IDE 从项目根、mvn 从 backend 启动，
     * 两者 cwd 不同），先按配置解析，找不到则按常见候选兜底（同 RecommendVideoService）。
     */
    private Path resolveScriptsDir() {
        Path configured = Paths.get(scriptsDir);
        if (isScript(configured)) {
            return configured;
        }
        List<Path> candidates = List.of(
                Paths.get(scriptsDir).toAbsolutePath(),
                Paths.get("backend/scripts").toAbsolutePath(),
                Paths.get("../backend/scripts").toAbsolutePath(),
                Paths.get("../scripts").toAbsolutePath(),
                Paths.get("scripts").toAbsolutePath());
        for (Path p : candidates) {
            if (isScript(p)) {
                log.warn("scripts-dir {} 下无 omofuna.js，改用 {}", scriptsDir, p);
                return p;
            }
        }
        return configured;
    }

    private static boolean isScript(Path dir) {
        return dir != null && Files.isRegularFile(dir.resolve("omofuna.js"));
    }
}
