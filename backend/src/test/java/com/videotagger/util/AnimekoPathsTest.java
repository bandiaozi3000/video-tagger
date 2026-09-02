package com.videotagger.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** AnimekoPaths.resolveExe：配置优先；空配置回退探测（不抛错）。 */
class AnimekoPathsTest {

    @Test
    @DisplayName("显式 exe 配置优先")
    void explicitExeWins() {
        assertEquals("C:/x/Ani.exe", AnimekoPaths.resolveExe("C:/x/Ani.exe"));
        // 空白视为未配置 → 回退自动探测（本机可能命中 D:\\Tool\\Ani\\Ani.exe 等）
        assertNotNull(AnimekoPaths.resolveExe("  "));
    }

    @Test
    @DisplayName("空配置自动探测不抛错（可能命中运行中进程或候选安装位）")
    void autoDetectNoThrow() {
        String exe = AnimekoPaths.resolveExe("");
        // 本机可能命中 D:\Tool\Ani\Ani.exe 或进程探测；无法断言具体值，只保证返回合规
        assertNotNull(exe);
        if (!exe.isBlank()) {
            assertTrue(java.nio.file.Files.isRegularFile(java.nio.file.Path.of(exe)),
                    "探测结果应为存在的文件: " + exe);
        }
    }
}
