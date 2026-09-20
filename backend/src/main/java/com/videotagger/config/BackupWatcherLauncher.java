package com.videotagger.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 后端启动时**确保 MySQL 备份监工在跑**（`scripts/backup-mysql-watch.ps1`），此后每 5 分钟看护一次。
 * 用户 2026-09-20 指令：「改成当我启动后端的时候跑同步定时」——即不再依赖手动 `install-backup-watcher.ps1`。
 *
 * 为什么不把备份逻辑搬进 Java（`@Scheduled` + ProcessBuilder 调 docker）：那个脚本已经做全了
 * 「等容器健康 → 立刻备份一次 → 每 60 分钟一次 → 双写项目 `data/backup` 与 `%LOCALAPPDATA%\VideoTagger\backup`
 * → 校验两份大小一致 → 留 3 代 → 全局互斥」，重写只会多一份要维护的实现。这里只负责**生命周期**。
 *
 * 行为要点：
 * <ul>
 *   <li>监工是**守护**：不跟后端同生共死（后端重启/关掉不影响正在跑的备份节奏），
 *       多实例由脚本的全局互斥 `Global\VideoTagger-MySqlBackupWatcher` 保证只有一个真在跑；</li>
 *   <li>子进程**以 0 退出 = 已有别的实例在跑**（互斥让路），看护不再重拉；非 0 退出才重拉；</li>
 *   <li>失败**绝不影响启动**：脚本不存在 / 非 Windows / 没有 PowerShell 都只记日志；</li>
 *   <li>看护间隔可用 `videotagger.backup.watchdog-ms` 调（默认 300000 = 5 分钟）。</li>
 * </ul>
 *
 * 开关：`videotagger.backup.enabled`（默认 true，可用 `BACKUP_WATCHER_ENABLED=false` 关掉；关掉不会去杀已在跑的实例）。
 */
@Component
public class BackupWatcherLauncher {
    private static final Logger log = LoggerFactory.getLogger(BackupWatcherLauncher.class);

    private final boolean enabled;
    private final String script;
    private Process process;

    public BackupWatcherLauncher(@Value("${videotagger.backup.enabled:true}") boolean enabled,
                                 @Value("${videotagger.backup.script:scripts/backup-mysql-watch.ps1}") String script) {
        this.enabled = enabled;
        this.script = script;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        if (!enabled) {
            log.info("MySQL 备份监工未启用（videotagger.backup.enabled=false）");
            return;
        }
        if (!System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win")) {
            log.info("MySQL 备份监工仅支持 Windows（脚本是 PowerShell），当前系统跳过");
            return;
        }
        Path resolved = resolveScript();
        if (resolved == null) {
            log.warn("未找到备份脚本（期望 scripts/backup-mysql-watch.ps1），跳过备份监工");
            return;
        }
        try {
            List<String> command = new ArrayList<>(List.of("powershell.exe", "-NoLogo", "-NoProfile",
                    "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass",
                    "-File", resolved.toString()));
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.directory(resolved.getParent().getParent().toFile());   // 脚本自己算 $PSScriptRoot，这里只为相对路径口径一致
            builder.redirectOutput(ProcessBuilder.Redirect.DISCARD);
            builder.redirectError(ProcessBuilder.Redirect.DISCARD);
            process = builder.start();
            log.info("MySQL 备份监工已启动（pid={}，脚本 {}）—— 容器健康即备份一次，之后每 60 分钟一次",
                    process.pid(), resolved);
        } catch (IOException e) {
            log.warn("MySQL 备份监工启动失败（不影响服务）: {}", e.getMessage());
            process = null;
        }
    }

    /**
     * 看护：子进程不在了就重新拉起。
     *
     * 退出码 0 视为「已有别的实例在跑（互斥让路）或单次备份成功」，不重拉 —— 否则后端每次重启后
     * 都会因为原实例还活着而每 5 分钟空拉一个立刻退出的小进程。
     */
    @Scheduled(fixedDelayString = "${videotagger.backup.watchdog-ms:300000}",
            initialDelayString = "${videotagger.backup.watchdog-ms:300000}")
    public void watchdog() {
        if (!enabled) return;
        if (process != null) {
            if (process.isAlive()) return;
            if (process.exitValue() == 0) return;
            log.warn("MySQL 备份监工已退出（exit={}），重新拉起", process.exitValue());
            process = null;
        }
        start();
    }

    /** 定位脚本：IDE 从项目根启动、`mvn spring-boot:run` 从 backend 启动、打包后可能不在两者之下。 */
    private Path resolveScript() {
        for (Path candidate : List.of(Paths.get(script),
                Paths.get("../").resolve(script),
                Paths.get("backend").resolve(script))) {
            Path path = candidate.toAbsolutePath().normalize();
            if (Files.isRegularFile(path)) return path;
        }
        return null;
    }
}
