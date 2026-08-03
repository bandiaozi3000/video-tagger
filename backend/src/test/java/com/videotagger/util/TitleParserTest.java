package com.videotagger.util;

import com.videotagger.util.TitleParser.ParsedTitle;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TitleParserTest {

    @Test
    void bilibiliPageTitle() {
        ParsedTitle p = TitleParser.parse("葬送的芙莉莲 第3集_哔哩哔哩_bilibili");
        assertEquals("葬送的芙莉莲", p.animeTitle());
        assertNull(p.season());
        assertEquals(3, p.episodeNo());
    }

    @Test
    void chineseSeasonAndEpisode() {
        ParsedTitle p = TitleParser.parse("芙莉莲 第二季 第1话");
        assertEquals("芙莉莲", p.animeTitle());
        assertEquals(2, p.season());
        assertEquals(1, p.episodeNo());
    }

    @Test
    void sxxExxPattern() {
        ParsedTitle p = TitleParser.parse("Frieren S2E1");
        assertEquals("Frieren", p.animeTitle());
        assertEquals(2, p.season());
        assertEquals(1, p.episodeNo());
    }

    @Test
    void seasonAndEpisodeEnglish() {
        ParsedTitle p = TitleParser.parse("葬送的芙莉莲 Season 2 Episode 5");
        assertEquals("葬送的芙莉莲", p.animeTitle());
        assertEquals(2, p.season());
        assertEquals(5, p.episodeNo());
    }

    @Test
    void bracketPrefixCleaned() {
        ParsedTitle p = TitleParser.parse("【4月】葬送的芙莉莲 魔法考试篇 第1集");
        assertEquals("葬送的芙莉莲 魔法考试篇", p.animeTitle());
        assertEquals(1, p.episodeNo());
    }

    @Test
    void youtubeSuffixStripped() {
        ParsedTitle p = TitleParser.parse("Sword Art Online Episode 3 | YouTube");
        assertEquals("Sword Art Online", p.animeTitle());
        assertEquals(3, p.episodeNo());
    }

    @Test
    void bareEpNumber() {
        ParsedTitle p = TitleParser.parse("剑风传奇 第7话");
        assertEquals("剑风传奇", p.animeTitle());
        assertEquals(7, p.episodeNo());
    }

    @Test
    void unparseableFallsBackToWholeTitle() {
        ParsedTitle p = TitleParser.parse("一部没有规律的标题文本");
        assertEquals("一部没有规律的标题文本", p.animeTitle());
        assertNull(p.season());
        assertNull(p.episodeNo());
    }

    @Test
    void nullTitleGivesEmpty() {
        ParsedTitle p = TitleParser.parse(null);
        assertEquals("", p.animeTitle());
        assertNull(p.episodeNo());
    }

    @Test
    void chineseNumbers() {
        assertEquals(10, TitleParser.cnToInt("十"));
        assertEquals(15, TitleParser.cnToInt("十五"));
        assertEquals(21, TitleParser.cnToInt("二十一"));
        assertEquals(2, TitleParser.cnToInt("二"));
    }
}
