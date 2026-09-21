package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.VideoExportTaskRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/** 导出任务表（V10）。查询都带 limit —— 任务列表是给人看的，不需要全表。 */
@Mapper
public interface VideoExportTaskMapper extends BaseMapper<VideoExportTaskRow> {

    @Select("SELECT * FROM video_export_task ORDER BY id DESC LIMIT #{limit}")
    List<VideoExportTaskRow> listRecent(@Param("limit") int limit);

    /** 启动接管：把上次进程留下的 RUNNING 全部标成中断（不假装还在跑）。 */
    @Update("UPDATE video_export_task SET status = 'INTERRUPTED', message = #{reason}, finished_at = #{now}, updated_at = #{now}"
            + " WHERE status = 'RUNNING'")
    int markRunningAsInterrupted(@Param("reason") String reason, @Param("now") long now);

    /** 启动接管用：拿上次遗留的子进程 pid。 */
    @Select("SELECT id, child_pid FROM video_export_task WHERE child_pid IS NOT NULL AND status IN ('RUNNING', 'INTERRUPTED')")
    List<VideoExportTaskRow> listWithChildPid();

    @Update("UPDATE video_export_task SET child_pid = NULL, updated_at = #{now} WHERE id = #{id}")
    int clearChildPid(@Param("id") long id, @Param("now") long now);

    /** PENDING → RUNNING（只允许从 PENDING 推进，避免重复启动）。 */
    @Update("UPDATE video_export_task SET status = 'RUNNING', started_at = #{now}, updated_at = #{now}"
            + " WHERE id = #{id} AND status = 'PENDING'")
    int markRunning(@Param("id") long id, @Param("now") long now);

    /** 终态 → RUNNING（局部重渲：从 DONE/INTERRUPTED 等回到渲染中）。 */
    @Update("UPDATE video_export_task SET status = 'RUNNING', message = NULL, finished_at = NULL, updated_at = #{now} WHERE id = #{id}")
    int markRunningFromTerminal(@Param("id") long id, @Param("now") long now);

    @Update("UPDATE video_export_task SET work_dir = #{dir}, updated_at = #{now} WHERE id = #{id}")
    int setWorkDir(@Param("id") long id, @Param("dir") String dir, @Param("now") long now);

    @Update("UPDATE video_export_task SET child_pid = #{pid}, updated_at = #{now} WHERE id = #{id}")
    int setChildPid(@Param("id") long id, @Param("pid") Long pid, @Param("now") long now);

    /** 进度：只在 RUNNING 时写（已取消/已结束的任务不会被重新写活）。 */
    @Update("UPDATE video_export_task SET progress = #{pct}, updated_at = #{now}"
            + " WHERE id = #{id} AND status = 'RUNNING'")
    int updateProgress(@Param("id") long id, @Param("pct") int pct, @Param("now") long now);

    /** 分块进度：已完成块数 / 总块数 + 实时状态文案。 */
    @Update("UPDATE video_export_task SET chunks_done = #{done}, chunks_total = #{total}, stage_text = #{stage}, updated_at = #{now} WHERE id = #{id} AND status = 'RUNNING'")
    int updateChunks(@Param("id") long id, @Param("done") int done, @Param("total") int total,
                     @Param("stage") String stage, @Param("now") long now);

    /** 只改实时状态文案（准备素材阶段用）。 */
    @Update("UPDATE video_export_task SET stage_text = #{stage}, updated_at = #{now} WHERE id = #{id} AND status = RUNNING")
    int updateStage(@Param("id") long id, @Param("stage") String stage, @Param("now") long now);

    @Update("UPDATE video_export_task SET boundary_frames = #{json}, updated_at = #{now} WHERE id = #{id}")
    int setBoundaryFrames(@Param("id") long id, @Param("json") String json, @Param("now") long now);

    /** 暂停：只从 RUNNING 推进（渲染线程每块渲完会查状态，看到非 RUNNING 就停在块边界）。 */
    @Update("UPDATE video_export_task SET status = 'PAUSED', message = '已暂停（已完成块保留，可继续）', updated_at = #{now} WHERE id = #{id} AND status = 'RUNNING'")
    int pauseTask(@Param("id") long id, @Param("now") long now);

    /** 终态：只从 PENDING/RUNNING 推进，已经取消或结束的不被覆盖。 */
    @Update("UPDATE video_export_task SET status = #{status}, message = #{message}, file_path = #{filePath},"
            + " finished_at = #{now}, updated_at = #{now} WHERE id = #{id} AND status IN ('PENDING', 'RUNNING')")
    int finishIfActive(@Param("id") long id, @Param("status") String status, @Param("message") String message,
                       @Param("filePath") String filePath, @Param("now") long now);
}
