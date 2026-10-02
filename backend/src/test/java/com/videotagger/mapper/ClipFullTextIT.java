package com.videotagger.mapper;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.TestTagSeed;
import com.videotagger.entity.Clip;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClipFullTextIT extends AbstractMySqlIT {

    @Autowired
    ClipMapper clipMapper;
    @Autowired
    TagMapper tagMapper;
    @Autowired
    ClipTagMapper clipTagMapper;

    private Clip clip(String tag, String note) {
        Clip c = new Clip();
        c.setTitle("某动画");
        c.setUrl("https://a.com/" + tag);
        c.setTimestampSec(1.0);
        c.setNote(note);
        c.setCreatedAt(System.currentTimeMillis());
        return c;
    }

    /** v0.31：标签真源 = clip_tag，插入片段后再建关联。 */
    private void tag(Clip clip, String name) {
        TestTagSeed.tag(clipTagMapper, tagMapper, clip.getId(), name);
    }

    @Test
    void fullTextSearchMatchesChineseTag() {
        Clip a = clip("高燃战斗场面", "");
        clipMapper.insert(a);
        tag(a, "高燃战斗场面");
        Clip b = clip("温馨日常", "");
        clipMapper.insert(b);
        tag(b, "温馨日常");
        Clip c = clip("名场面", "高潮");
        clipMapper.insert(c);
        tag(c, "战斗");

        List<Clip> hits = clipMapper.fullTextSearch("战斗", 10);

        assertEquals(2, hits.size());
    }

    @Test
    void fullTextSearchNoMatchReturnsEmpty() {
        clipMapper.insert(clip("高燃战斗场面", ""));

        List<Clip> hits = clipMapper.fullTextSearch("预算会议", 10);

        assertEquals(0, hits.size());
    }
}
