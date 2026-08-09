package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 站点级设置键值（skey → JSON value），如背景图轮播配置。 */
@Data
@TableName("site_setting")
public class SiteSetting {
    /** skey（原 key 是 MySQL 保留字，V16 迁移已改名）。 */
    @TableId
    private String skey;
    private String value;
}
