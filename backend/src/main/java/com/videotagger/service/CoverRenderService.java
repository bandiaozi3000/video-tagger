package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 封面工坊出图（2026-09-29）。
 *
 * **一句话**：把编辑器里那块「画布」的原样 HTML + CSS 交给 Chrome headless 截图，再转成 JPEG 落盘。
 *
 * 为什么让前端把 HTML 传过来（而不是后端自己拼版式）：
 *   编辑器里的**实时预览**与**导出成品**必须是同一份结构与样式，否则 21 套版式在两边各写一遍迟早漂移。
 *   所以版式只有一个真源（`editor/cover/`），导出时后端只负责"当打印机"：套壳 → 跑 Chrome → 转码。
 *
 * 与既有渲染链路的关系：不走 Node/Remotion（那套是逐帧视频）；封面是一次一张的静态图，
 * 直接 {@code chrome --headless --screenshot} + ImageIO 转 JPEG，**零新依赖**。
 * Chrome 路径沿用 `videotagger.render.chrome-path`（与视频导出同一个浏览器）。
 */
@Service
public class CoverRenderService {

    private static final Logger log = LoggerFactory.getLogger(CoverRenderService.class);

    /** 画布固定 16:9 / 1920×1080（B 站投稿封面规格）。 */
    public static final int WIDTH = 1920;
    public static final int HEIGHT = 1080;

    /** 与前端 `cover-css.ts` 的 `COVER_FONT_TOKEN` 同一个占位符（改一处就要改两处）。 */
    private static final String COVER_FONT_TOKEN = "__CV_FONT_BASE__";

    /** 提交上来的 HTML/CSS 上限：正常画布 20~60KB，超过这个量级说明不是封面。 */
    private static final int MAX_MARKUP_CHARS = 400_000;
    /** Chrome 出图超时（秒）：实测单张 1~3s，给足余量。 */
    private static final int CHROME_TIMEOUT_SEC = 90;

    /** 危险片段（本地单机应用，但仍不允许把脚本交给浏览器执行）。 */
    private static final Pattern DANGEROUS = Pattern.compile(
            "(?i)<\\s*script|</\\s*iframe|\\son[a-z]+\\s*=|javascript:");
    /** 画布里的封面引用 → 换成 file:// 绝对路径（Chrome 从 file:// 页面读本地图）。 */
    private static final Pattern COVER_REF = Pattern.compile("(/covers/[A-Za-z0-9_./\\-]+)");

    private final String chromePath;
    private final Path coverDir;

    public CoverRenderService(@Value("${videotagger.render.chrome-path}") String chromePath,
                              @Value("${videotagger.cover-dir:data/covers}") String coverDir) {
        this.chromePath = chromePath;
        this.coverDir = Paths.get(coverDir).toAbsolutePath().normalize();
    }

    /** 出图请求：画布 HTML（一个根元素）+ 样式 + 文件名前缀。 */
    public record ExportRequest(String html, String css, String name) {
    }

    /** 出图结果：静态可访问 url + 绝对路径 + 体积。 */
    public record ExportResult(String url, String path, int width, int height, long bytes) {
    }

    /**
     * 出图。
     *
     * @param html 画布 HTML（编辑器实时 DOM 的 outerHTML）
     * @param css  画布样式（与编辑器的注入样式**同一份字符串**）
     * @param name 文件名前缀（取推荐草稿标题；非法字符会被替换）
     */
    public ExportResult export(String html, String css, String name) {
        if (html == null || html.isBlank()) {
            throw new IllegalArgumentException("画布内容为空");
        }
        if (html.length() > MAX_MARKUP_CHARS || (css != null && css.length() > MAX_MARKUP_CHARS)) {
            throw new IllegalArgumentException("画布内容过大");
        }
        Matcher bad = DANGEROUS.matcher(html);
        if (bad.find()) {
            throw new IllegalArgumentException("画布内容含不允许的标记：" + bad.group());
        }
        Path work = null;
        try {
            work = Files.createTempDirectory("vt-cover-");
            Path page = work.resolve("cover.html");
            Files.writeString(page, pageHtml(html, css), StandardCharsets.UTF_8);

            Path shot = work.resolve("shot.png");
            runChrome(page, shot);
            if (!Files.isRegularFile(shot)) {
                throw new IllegalStateException("Chrome 未产出截图（检查 chrome-path 是否可用）");
            }
            Path out = outputFile(name);
            long bytes = toJpeg(shot, out);
            log.info("封面出图完成：{}（{} KB）", out.getFileName(), bytes / 1024);
            return new ExportResult("/covers/make/" + out.getFileName(), out.toString(), WIDTH, HEIGHT, bytes);
        } catch (IOException e) {
            throw new IllegalStateException("封面出图失败：" + e.getMessage(), e);
        } finally {
            deleteQuietly(work);
        }
    }

    // —— 内部 ——

    /** 套壳页面（包级可见：给单测盯 token 替换与 /covers 改写）：字体声明由前端 CSS 里的占位符统一替换。 */
    String pageHtml(String html, String css) {
        String style = css == null ? "" : rewriteRefs(css).replace(COVER_FONT_TOKEN, fontBase());
        String body = rewriteRefs(html);
        return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">"
                + "<style>html,body{margin:0;padding:0;background:#000;overflow:hidden}</style>"
                + "<style>" + style + "</style></head><body>" + body + "</body></html>";
    }

    /** 字体目录的 file:// 基址（项目内 `backend/remotion/public/fonts`，两种工作目录都要能命中）。 */
    private String fontBase() {
        for (Path dir : List.of(
                Paths.get("backend/remotion/public/fonts"),
                Paths.get("../backend/remotion/public/fonts"),
                Paths.get("remotion/public/fonts"))) {
            Path abs = dir.toAbsolutePath().normalize();
            if (Files.isDirectory(abs)) {
                return abs.toUri().toString().replaceAll("/$", "");
            }
        }
        return "fonts";
    }

    /** 把标记/样式里的 `/covers/**` 全部换成 file:// 绝对路径（img 与 background-image 都吃）。 */
    String rewriteRefs(String text) {
        return COVER_REF.matcher(text).replaceAll(match -> Matcher.quoteReplacement(resolveCover(match.group(1))));
    }

    /**
     * `/covers/clip/197.jpg` → `file:///.../covers/clip/197-xl.jpg`（存在则用大图）。
     *
     * 片段封面的大图/缩略图是 `{id}-xl.jpg` / `{id}.jpg` 两个文件；编辑器预览用缩略图（小图够快），
     * 导出自动升级到 xl（1280 宽）——不然 1920 画布上是 320 宽的糊图。
     */
    String resolveCover(String url) {
        Path file = coverDir.resolve(url.substring("/covers/".length())).normalize();
        if (!file.startsWith(coverDir)) {
            return url;   // 越界引用：原样返回（Chrome 拿不到图，不静默读到别的目录）
        }
        if (file.getFileName().toString().endsWith(".jpg")) {
            String name = file.getFileName().toString();
            Path xl = file.resolveSibling(name.substring(0, name.length() - 4) + "-xl.jpg");
            if (Files.isRegularFile(xl)) {
                file = xl;   // 有 -xl 就用它（不看缩略图在不在；缩略图只是 320px，铺 1920 会糊）
            }
        }
        return file.toUri().toString();
    }

    private void runChrome(Path page, Path shot) {
        // ⚠️ `--user-data-dir` 必不可少：不给的话 Chrome 会**复用已存在的实例**（默认 profile 被占），
        // 此时 `--screenshot` 会被静默忽略 —— 实测连续出图时第 2 张开始就不产出文件（2026-09-29）。
        Path profile = page.getParent().resolve("profile");
        List<String> cmd = new ArrayList<>(List.of(
                chromePath,
                "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
                "--user-data-dir=" + profile.toAbsolutePath(),
                "--allow-file-access-from-files", "--force-device-scale-factor=1",
                "--window-size=" + WIDTH + "," + HEIGHT,
                // 等字体与图片就绪（纯静态页没有网络请求，虚拟时间足够）
                "--virtual-time-budget=10000",
                "--screenshot=" + shot.toAbsolutePath(),
                page.toUri().toString()));
        Process process = null;
        try {
            process = new ProcessBuilder(cmd).redirectErrorStream(true)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD).start();
            if (!process.waitFor(CHROME_TIMEOUT_SEC, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IllegalStateException("Chrome 出图超时（" + CHROME_TIMEOUT_SEC + "s）");
            }
        } catch (IOException e) {
            throw new IllegalStateException("无法启动 Chrome（" + chromePath + "）：" + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("出图被中断", e);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    /** 落盘目录：`covers/make/`（与 clip/ ep/ ext/ 并列；`/covers/**` 已有静态映射）。 */
    private Path outputFile(String name) throws IOException {
        Path dir = coverDir.resolve("make");
        Files.createDirectories(dir);
        String base = name == null || name.isBlank() ? "cover" : name.trim();
        base = base.replaceAll("[\\\\/:*?\"<>|\\s]+", "_");
        if (base.length() > 60) {
            base = base.substring(0, 60);
        }
        String stamp = new java.text.SimpleDateFormat("yyyyMMdd-HHmmss").format(new java.util.Date());
        return dir.resolve(base + "-" + stamp + ".jpg");
    }

    /** PNG 截图 → JPEG（q0.9，显式转 RGB：PNG 带 alpha，直写 JPEG 会出彩边）。 */
    private long toJpeg(Path png, Path jpeg) throws IOException {
        BufferedImage src = ImageIO.read(png.toFile());
        if (src == null) {
            throw new IllegalStateException("截图无法解码：" + png);
        }
        BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.drawImage(src, 0, 0, java.awt.Color.BLACK, null);
        g.dispose();
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(0.9f);
        try (ImageOutputStream out = ImageIO.createImageOutputStream(jpeg.toFile())) {
            writer.setOutput(out);
            writer.write(null, new IIOImage(rgb, null, null), param);
        } finally {
            writer.dispose();
        }
        return Files.size(jpeg);
    }

    private static void deleteQuietly(Path dir) {
        if (dir == null || !Files.exists(dir)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // 临时目录残留无害
                }
            });
        } catch (IOException e) {
            log.warn("封面临时目录清理失败：{}", dir, e);
        }
    }
}
