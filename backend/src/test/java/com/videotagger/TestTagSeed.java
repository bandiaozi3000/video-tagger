package com.videotagger;

import com.videotagger.entity.Tag;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.TagMapper;

import java.util.ArrayList;
import java.util.List;

/**
 * 测试用标签播种助手（v0.31 标签重做后：**真源 = clip_tag**，`clips.tag` 字符串列已删）。
 *
 * <p>`Clip.tag / tagIds / tagNames` 现在是从 `clip_tag` 派生出来的只读字段，
 * 测试里 `clip.setTag("x")` 不再落库 —— 必须用本助手先建词条再建关联。
 */
public final class TestTagSeed {

    private TestTagSeed() {
    }

    /** 保证词条存在，返回 id。 */
    public static long ensure(TagMapper tagMapper, String name) {
        tagMapper.insertIgnore(name, System.currentTimeMillis());
        Tag tag = tagMapper.selectByName(name);
        if (tag == null) {
            throw new IllegalStateException("词条播种失败: " + name);
        }
        return tag.getId();
    }

    /** 保证多词条存在，返回 id 列表（顺序同入参）。 */
    public static List<Long> ensure(TagMapper tagMapper, String... names) {
        List<Long> ids = new ArrayList<>();
        for (String name : names) {
            ids.add(ensure(tagMapper, name));
        }
        return ids;
    }

    /** 把片段打上这些标签（先建词条再写关联）。返回标签 id 列表。 */
    public static List<Long> tag(ClipTagMapper clipTagMapper, TagMapper tagMapper, long clipId, String... names) {
        List<Long> ids = ensure(tagMapper, names);
        for (Long id : ids) {
            clipTagMapper.insertIgnore(clipId, id);
        }
        return ids;
    }
}
