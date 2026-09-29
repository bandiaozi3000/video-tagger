package com.videotagger.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 封面出图服务里"不会碰 Chrome 的那半"（2026-09-29）：
 * 素材路径改写 / 字体占位符 / 危险标记拦截 —— 这三件错了会静默出糊图或空图，必须被单测盯住。
 *
 * 真正的 Chrome 出图不进单测（依赖本机浏览器）：那一步由真实验收覆盖（导出后看成品）。
 */
class CoverRenderServiceTest {

    private CoverRenderService serviceWith(Path coverDir) {
        // chromePath 不参与这几个用例（这里不跑浏览器），给个占位值即可
        return new CoverRenderService("chrome-not-used", coverDir.toString());
    }

    @Test
    void 片段封面优先用_xl_大图(@TempDir Path coverDir) throws IOException {
        Path clip = coverDir.resolve("clip");
        Files.createDirectories(clip);
        Files.writeString(clip.resolve("7.jpg"), "thumb");
        Files.writeString(clip.resolve("7-xl.jpg"), "xl");
        CoverRenderService service = serviceWith(coverDir);

        String url = service.resolveCover("/covers/clip/7.jpg");

        assertTrue(url.endsWith("7-xl.jpg"), "有 -xl 时必须用大图（320px 缩略图铺 1920 画布会糊）：" + url);
        assertTrue(url.startsWith("file://"), "要换成 file:// 绝对路径（Chrome 从 file:// 页面读本地图）：" + url);
    }

    @Test
    void 没有_xl_时退回原图(@TempDir Path coverDir) throws IOException {
        Path clip = coverDir.resolve("clip");
        Files.createDirectories(clip);
        Files.writeString(clip.resolve("8.jpg"), "thumb");

        String url = serviceWith(coverDir).resolveCover("/covers/clip/8.jpg");

        assertTrue(url.endsWith("8.jpg"), url);
    }

    @Test
    void 越界引用原样返回_不读封面目录以外的文件(@TempDir Path coverDir) {
        String url = serviceWith(coverDir).resolveCover("/covers/../../etc/passwd");

        assertEquals("/covers/../../etc/passwd", url);
    }

    @Test
    void 套壳页面替换字体占位符并改写封面地址(@TempDir Path coverDir) throws IOException {
        Files.createDirectories(coverDir.resolve("clip"));
        Files.writeString(coverDir.resolve("clip").resolve("9.jpg"), "x");
        String html = "<div class=\"cv\"><img src=\"/covers/clip/9.jpg\"></div>";
        String css = ".cv{background:url('/covers/clip/9.jpg')}@font-face{src:url('__CV_FONT_BASE__/Mona-Sans.ttf')}";

        String page = serviceWith(coverDir).pageHtml(html, css);

        assertTrue(page.contains("file://"), "img 与 background 都要被改写成 file://：" + page);
        assertTrue(page.contains("Mona-Sans.ttf"), page);
        assertTrue(!page.contains("__CV_FONT_BASE__"), "字体占位符必须被换成真实目录：" + page);
    }

    @Test
    void 危险标记直接拒绝(@TempDir Path coverDir) {
        CoverRenderService service = serviceWith(coverDir);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.export("<div onclick=\"alert(1)\"></div>", "", "x"));
        assertTrue(error.getMessage().contains("不允许"), error.getMessage());

        assertThrows(IllegalArgumentException.class,
                () -> service.export("<script>alert(1)</script>", "", "x"));
    }

    @Test
    void 空画布拒绝(@TempDir Path coverDir) {
        assertThrows(IllegalArgumentException.class, () -> serviceWith(coverDir).export("  ", "", "x"));
    }
}
