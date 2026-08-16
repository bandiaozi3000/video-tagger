-- 测试专用：模拟未来加列迁移（test classpath 才有，生产打包不含）
ALTER TABLE media ADD COLUMN test_col2 INTEGER;
