-- V2：为时间线视图添加视频指纹与可选的视频时长
-- video_fp 在保存时由应用计算（VideoFingerprint），历史数据由 VideoFingerprintBackfill 启动回填
ALTER TABLE clips
    ADD COLUMN video_fp VARCHAR(64) NULL AFTER url,
    ADD COLUMN video_duration DOUBLE NULL AFTER timestamp_sec;

CREATE INDEX idx_clips_video_fp ON clips (video_fp);
