package com.videotagger.mapper;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.entity.Clip;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClipFullTextIT extends AbstractMySqlIT {

    @Autowired
    ClipMapper clipMapper;

    private Clip clip(String tag, String note) {
        Clip c = new Clip();
        c.setTitle("某动画");
        c.setUrl("https://a.com/" + tag);
        c.setTimestampSec(1.0);
        c.setTag(tag);
        c.setNote(note);
        c.setCreatedAt(System.currentTimeMillis());
        return c;
    }

    @Test
    void fullTextSearchMatchesChineseTag() {
        clipMapper.insert(clip("高燃战斗场面", ""));
        clipMapper.insert(clip("温馨日常", ""));
        clipMapper.insert(clip("主角战斗爆发击败反派", "高潮"));

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
