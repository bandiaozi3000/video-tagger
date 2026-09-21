package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.AbstractMySqlIT;
import com.videotagger.config.ExportTaskRecovery;
import com.videotagger.entity.VideoExportTaskRow;
import com.videotagger.mapper.VideoExportTaskMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/**
 * 导出任务持久化（Flyway V35）与状态机 IT —— 真 MySQL（Testcontainers）。
 *
 * 覆盖用户 2026-09-21 拍板要点：
 *   · 任务进库、跨"重启"可查（这里用直接查库模拟另一个进程）
 *   · PENDING → RUNNING → 终态 的**单向**推进（已取消的不被完成覆盖）
 *   · 取消后工作目录保留、删除只清任务行 + 工作目录
 *   · 启动接管把残留 RUNNING 标成 INTERRUPTED
 */
class VideoExportTaskServiceIT extends AbstractMySqlIT {

    @Autowired
    VideoExportTaskMapper mapper;

    /** 只测持久化 / 状态机，不真渲染。 */
    private VideoExportTaskService service() {
        return new VideoExportTaskService(mock(RecommendVideoService.class), mapper, new ObjectMapper());
    }

    private long insertTask(String status, Long childPid) {
        long now = System.currentTimeMillis();
        VideoExportTaskRow row = new VideoExportTaskRow();
        row.setTitle("IT 任务");
        row.setMediaCount(3);
        row.setStatus(status);
        row.setFormat("MP4");
        row.setProgress(0);
        row.setChildPid(childPid);
        row.setRequestJson("{\"note\":\"it\"}");
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        mapper.insert(row);
        assertNotNull(row.getId());
        return row.getId();
    }

    @Test
    void 任务进库并能按最新排序列出() {
        long id = insertTask("PENDING", null);
        List<VideoExportTaskRow> rows = mapper.listRecent(5);
        assertTrue(rows.stream().anyMatch(r -> r.getId() == id));
        assertEquals(id, rows.get(0).getId(), "最新插入的应排在第一");
    }

    @Test
    void 状态只能单向推进_已取消的不被完成覆盖() {
        long id = insertTask("PENDING", null);
        assertEquals(1, mapper.markRunning(id, System.currentTimeMillis()));
        assertEquals("RUNNING", mapper.selectById(id).getStatus());

        // 取消（这里直接走终态写入，模拟 cancel 的落库动作）
        assertEquals(1, mapper.finishIfActive(id, "CANCELLED", "已取消", null, System.currentTimeMillis()));
        // 渲染线程随后"完成"也不该覆盖 CANCELLED
        assertEquals(0, mapper.finishIfActive(id, "DONE", null, "D:/x.mp4", System.currentTimeMillis()));
        assertEquals("CANCELLED", mapper.selectById(id).getStatus());
    }

    @Test
    void 进度只在RUNNING时写入() {
        long id = insertTask("PENDING", null);
        assertEquals(0, mapper.updateProgress(id, 42, System.currentTimeMillis()), "排队中不写进度");
        mapper.markRunning(id, System.currentTimeMillis());
        assertEquals(1, mapper.updateProgress(id, 42, System.currentTimeMillis()));
        assertEquals(42, mapper.selectById(id).getProgress());
    }

    @Test
    void 取消_运行中可取消_结束后不可取消() {
        VideoExportTaskService svc = service();
        long running = insertTask("RUNNING", null);      // child_pid 为空 → 不涉及杀进程
        assertTrue(svc.cancel(running), "运行中应能取消");
        assertEquals("CANCELLED", mapper.selectById(running).getStatus());

        long done = insertTask("DONE", null);
        assertFalse(svc.cancel(done), "已结束的任务无事可做");
    }

    @Test
    void 删除_只删任务行_运行中拒绝() {
        VideoExportTaskService svc = service();
        long done = insertTask("DONE", null);
        svc.delete(done);
        assertEquals(null, mapper.selectById(done));

        long running = insertTask("RUNNING", null);
        assertThrows(IllegalStateException.class, () -> svc.delete(running), "运行中要先取消");
        assertNotNull(mapper.selectById(running));
    }

    @Test
    void 启动接管_残留RUNNING标记为INTERRUPTED() {
        long id = insertTask("RUNNING", null);
        new ExportTaskRecovery(mapper).recover();
        VideoExportTaskRow row = mapper.selectById(id);
        assertEquals("INTERRUPTED", row.getStatus());
        assertTrue(row.getMessage().contains("重启中断"));
        assertTrue(row.getFinishedAt() > 0, "中断也要有结束时间（列表要显示耗时）");
    }
}
