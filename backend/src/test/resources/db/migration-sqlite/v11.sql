-- v0.24 M3 素材渠道化：clips 增加 channel_hints（JSON 数组：C1 本地池 / C2 Animeko / C3 网页直链 / C4 录屏 线索）
ALTER TABLE clips ADD COLUMN channel_hints TEXT;
