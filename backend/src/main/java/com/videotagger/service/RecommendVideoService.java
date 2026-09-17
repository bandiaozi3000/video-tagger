package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 推荐 HTML → MP4 视频渲染编排。
 *
 * 链路：RecommendService.buildHtml 生成自包含 HTML → 写临时文件 → ProcessBuilder 调
 * {@code node render.js}（puppeteer-core 连系统 Chrome 按 screencast 抓帧 + ffmpeg 合成）→
 * 返回 mp4 路径。同步阻塞直至渲染完成。
 *
 * 依赖本机工具链（node / Chrome / ffmpeg），Docker 容器内未装 → 配置缺失时给出清晰错误。
 */
@Service
public class RecommendVideoService {

    private static final Logger log = LoggerFactory.getLogger(RecommendVideoService.class);
    private static final DateTimeFormatter FILE_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final long RENDER_TIMEOUT_SECONDS = 40 * 60;   // 多部一屏 + 1080P 以下导出够用；4K 编码慢，放宽到 40 分钟

    /** 分辨率 → 像素。 */
    private static final Map<String, int[]> RESOLUTIONS = Map.of(
            "720P", new int[]{1280, 720},
            "1080P", new int[]{1920, 1080},
            "4K", new int[]{3840, 2160});

    /** 视频格式 → 输出扩展名（render.js 按此选 ffmpeg 编码器）。 */
    private static final Map<String, String> FORMATS = Map.of(
            "MP4", "mp4",
            "WEBM", "webm");

    private final RecommendService recommendService;
    private final RecommendClipSourceService clipSourceService;

    private final String scriptsDir;
    private final String nodePath;
    private final String chromePath;
    private final String ffmpegPath;
    private final String remotionDir;
    private final String ffprobePath;

    @Autowired
    public RecommendVideoService(RecommendService recommendService,
                                 RecommendClipSourceService clipSourceService,
                                 @Value("${videotagger.render.scripts-dir}") String scriptsDir,
                                 @Value("${videotagger.render.node-path}") String nodePath,
                                 @Value("${videotagger.render.chrome-path}") String chromePath,
                                 @Value("${videotagger.render.ffmpeg-path}") String ffmpegPath,
                                 @Value("${videotagger.render.remotion-dir:backend/remotion}") String remotionDir,
                                 @Value("${videotagger.render.ffprobe-path:}") String ffprobePath) {
        this.recommendService = recommendService;
        this.clipSourceService = clipSourceService;
        this.scriptsDir = scriptsDir;
        this.nodePath = nodePath;
        this.chromePath = chromePath;
        this.ffmpegPath = ffmpegPath;
        this.remotionDir = remotionDir;
        this.ffprobePath = ffprobePath;
    }

    public RecommendVideoService(RecommendService recommendService,
                                 @Value("${videotagger.render.scripts-dir}") String scriptsDir,
                                 @Value("${videotagger.render.node-path}") String nodePath,
                                 @Value("${videotagger.render.chrome-path}") String chromePath,
                                 @Value("${videotagger.render.ffmpeg-path}") String ffmpegPath) {
        this(recommendService, null, scriptsDir, nodePath, chromePath, ffmpegPath, "backend/remotion", "");
    }


    public Path render(List<Long> ids, String resolution) {
        return render(ids, null, null, resolution, null, null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1, null);
    }

    /** 渲染推荐媒体为视频（无 BGM）。 */
    public Path render(List<Long> ids, String title, String format, String resolution) {
        return render(ids, title, format, resolution, null, null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1, null);
    }

    /** 渲染推荐媒体为视频（单曲 BGM，兼容旧签名）。 */
    public Path render(List<Long> ids, String title, String format, String resolution, String bgmPath) {
        return render(ids, title, format, resolution,
                bgmPath == null || bgmPath.isBlank() ? null : List.of(bgmPath), null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1, null);
    }

    /**
     * 渲染推荐媒体为视频（MP4/WebM），返回临时文件路径（调用方负责删除）。
     *
     * @param ids         媒体 id 列表
     * @param title       推荐页标题文案（主题），空 → 默认
     * @param format      视频格式 MP4/WEBM，空 → mp4
     * @param resolution  清晰度 720P/1080P/4K
     * @param bgmPaths    背景音乐文件列表（多曲按序 ffmpeg concat 拼接后混入音轨），null/空 → 无 BGM
     * @param bgmTracks   背景音乐曲目（注入模板 BGM 条显示名称/进度/下一首提示；与 bgmPaths 同步），null/空 → 模板无 BGM 信息
     * @param groupBy     分组维度（none/year/subcategory/collection），空 → 不分组
     * @param groupStyle  分组呈现样式（stream/chapter/overview），空 → stream
     * @param subtitle    副标题（可空，模板主标题下方显示）
     * @param coverSize   开场封面大小 sm/md/lg（空 → md）
     * @param openingIds  开场代表秀子集（空 → 开场全显）
     * @param intro       主题简介（可空，模板开局后序言页显示；空 → 不显示序言页）
     * @param durations   显示时长（开局定格/序言/详情/结尾，秒）
     */
    public Path render(List<Long> ids, String title, String format, String resolution, List<String> bgmPaths,
                       List<RecommendService.BgmTrack> bgmTracks, String groupBy, String groupStyle,
                       String subtitle, String coverSize, List<Long> openingIds, String intro,
                       RecommendService.Durations durations, String endingTitle, String endingText,
                       String bgColor, List<String> bgImages, Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                       String prologueTitle,
                       String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                       Integer bgmScale,
                       Integer bgmX, Integer bgmY, String brandTitle, Integer perScreen,
                       Map<String, Boolean> detailShow) {
        return render(ids, title, format, resolution, bgmPaths, bgmTracks, groupBy, groupStyle,
                subtitle, coverSize, openingIds, intro, durations, endingTitle, endingText, bgColor,
                bgImages, bgRotationSec, bgOpacity, bgBlur, bgBrightness, prologueTitle, groupSort,
                openingSpeed, endingScrollSpeed, bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow, null);
    }

    public Path render(List<Long> ids, String title, String format, String resolution, List<String> bgmPaths,
                       List<RecommendService.BgmTrack> bgmTracks, String groupBy, String groupStyle,
                       String subtitle, String coverSize, List<Long> openingIds, String intro,
                       RecommendService.Durations durations, String endingTitle, String endingText,
                       String bgColor, List<String> bgImages, Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                       String prologueTitle,
                       String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                       Integer bgmScale,
                       Integer bgmX, Integer bgmY, String brandTitle, Integer perScreen,
                       Map<String, Boolean> detailShow,
                       Map<Long, RecommendMediaClips> requestedClips) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("ids 不能为空");
        }
        int[] wh = RESOLUTIONS.get(normalize(resolution));
        if (wh == null) {
            throw new IllegalArgumentException("未知清晰度: " + resolution + "（可选 720P/1080P/4K）");
        }
        String fmt = FORMATS.get(normalize(format));
        if (fmt == null) {
            throw new IllegalArgumentException("未知格式: " + format + "（可选 MP4/WEBM）");
        }

        Path html = null;
        try {
            // 1. 生成自包含 HTML → 临时文件。
            // 录制 HTML 只注入曲名+曲长、不注入 BGM base64：音频由最终混流独立混入，避免页面加载
            // 大型 Data URI 阻塞主线程导致逐曲漂移（音画彻底解耦的第一步）。
            List<RecommendService.BgmTrack> recordTracks = null;
            if (bgmTracks != null) {
                recordTracks = new ArrayList<>();
                for (RecommendService.BgmTrack t : bgmTracks) {
                    recordTracks.add(new RecommendService.BgmTrack(t.name(), null));
                }
            }
            // HTML 内容在工作区创建后生成，以便片段使用相对 media/ 路径。
            List<Double> bgmDurs = new ArrayList<>();
            Path work = Files.createTempDirectory("vt-recommend-");
            html = work.resolve("recommend.html");
            // 探测 BGM 时长并注入模板：headless 下 audio.duration 不可靠。
            if (bgmPaths != null) {
                for (String p : bgmPaths) bgmDurs.add(probeMediaDuration(p));
            }
            Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips = Map.of();
            if (requestedClips != null && !requestedClips.isEmpty()) {
                RecommendClipSourceService.PreparedClips result = clipSourceService.prepare(requestedClips, work);
                if (result.hasMissing()) {
                    throw new IllegalArgumentException("片段素材不可用: " + result.missing().stream()
                            .map(m -> "#" + m.clipId() + "(" + m.reason() + ")").toList());
                }
                preparedClips = result.byMedia();
            }
            String htmlContent = recommendService.buildHtml(ids, title, recordTracks, subtitle, coverSize, groupBy, groupStyle,
                    openingIds, intro, durations, endingTitle, endingText, bgColor, bgImages, bgRotationSec, bgOpacity,
                    bgBlur, bgBrightness, prologueTitle, groupSort, openingSpeed, endingScrollSpeed, bgmScale, bgmX, bgmY,
                    brandTitle, perScreen, "embed", detailShow, preparedClips);
            Files.writeString(html, htmlContent, StandardCharsets.UTF_8);
            if (!bgmDurs.isEmpty()) {
                htmlContent = htmlContent.replace("const BGM_TRACK_DURS = [];",
                        "const BGM_TRACK_DURS = " + bgmDursJson(bgmDurs) + ";");
                Files.writeString(html, htmlContent, StandardCharsets.UTF_8);
            }

            // 2. 背景音乐：多曲 → ffmpeg concat 拼接成单文件（统一 44100 stereo 顺序连接）；单曲直接用
            String bgmFile = null;
            if (bgmPaths != null && !bgmPaths.isEmpty()) {
                if (bgmPaths.size() == 1) {
                    bgmFile = bgmPaths.get(0);
                } else {
                    Path concat = work.resolve("bgm-concat.m4a");
                    List<String> cc = new ArrayList<>();
                    cc.add(ffmpegPath); cc.add("-y");
                    for (String p : bgmPaths) {
                        cc.add("-i"); cc.add(p);
                    }
                    StringBuilder fc = new StringBuilder();
                    for (int i = 0; i < bgmPaths.size(); i++) {
                        fc.append("[").append(i).append(":a]aresample=44100,aformat=channel_layouts=stereo[a")
                                .append(i).append("];");
                    }
                    fc.append("[a0]");
                    for (int i = 1; i < bgmPaths.size(); i++) {
                        fc.append("[a").append(i).append("]");
                    }
                    fc.append("concat=n=").append(bgmPaths.size()).append(":v=0:a=1[aout]");
                    cc.add("-filter_complex"); cc.add(fc.toString());
                    cc.add("-map"); cc.add("[aout]");
                    cc.add("-acodec"); cc.add("aac"); cc.add("-b:a"); cc.add("192k");
                    cc.add(concat.toAbsolutePath().toString());
                    ProcessBuilder pbc = new ProcessBuilder(cc);
                    pbc.redirectErrorStream(true);
                    Process pc = pbc.start();
                    String out2 = new String(pc.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                    int rc = pc.waitFor();
                    if (rc != 0) {
                        log.error("BGM concat 失败 {}:\n{}", rc, out2);
                        throw new IllegalStateException("BGM 拼接失败（ffmpeg 退出 " + rc + "）");
                    }
                    bgmFile = concat.toAbsolutePath().toString();
                }
            }

            // 3. 渲染：chapter 样式走 Remotion 逐帧渲染（产物带原声），其余样式（clip）仍走旧 render.js。
            if (clipSourceService != null && recommendService.isRemotionStyle(groupStyle)) {
                return renderWithRemotion(work, ids, title, fmt, wh, bgmFile, bgmTracks, subtitle, coverSize,
                        groupBy, groupStyle, openingIds, intro, durations, endingTitle, endingText, bgColor, bgImages,
                        bgRotationSec, bgOpacity, bgBlur, bgBrightness, prologueTitle, groupSort, openingSpeed,
                        endingScrollSpeed, bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow, preparedClips);
            }

            // 3. 时长 = 开局定格 + 序言(如有) + 章节×真实组数(如有分组) + 详情×N + 结尾（精确对齐显示时长配置，无缓冲）
            int introDur = (intro != null && !intro.isBlank()) ? durations.intro() : 0;
            int groupDur = (groupBy != null && !groupBy.isBlank() && !"none".equals(groupBy))
                    ? durations.group() * recommendService.computeGroupCount(ids, groupBy) : 0;
            int detailDur = durations.detail() * ids.size();
            if (!preparedClips.isEmpty()) {
                for (List<RecommendClipSourceService.PreparedClip> clips : preparedClips.values()) {
                    double clipSeconds = 0;
                    boolean hasOpenEnded = false;
                    for (RecommendClipSourceService.PreparedClip clip : clips) {
                        if (clip.startSec() != null && clip.endSec() != null) {
                            clipSeconds += Math.max(0, clip.endSec() - clip.startSec());
                        } else {
                            hasOpenEnded = true;
                        }
                    }
                    if (hasOpenEnded) clipSeconds += 2;
                    detailDur += Math.max(0, (int) Math.ceil(Math.max(durations.detail(), clipSeconds)) - durations.detail());
                }
            }
            int durationSeconds = durations.opening() + introDur + groupDur + detailDur + durations.ending();
            // 录制延长：结尾等当前 BGM 放完（模板 finishAuto 多等）→ render.js 兜底上限须覆盖「最长单曲余量」。
            // BGM 音轨 -stream_loop 无限循环，实际结束点由模板 data-tour-ended 驱动，这里只放宽兜底上限。
            int renderDurationSeconds = durationSeconds;
            if (!bgmDurs.isEmpty()) {
                double maxTrack = 0;
                for (double d : bgmDurs) {
                    maxTrack = Math.max(maxTrack, d);
                }
                if (maxTrack > 0) {
                    renderDurationSeconds = durationSeconds + (int) Math.ceil(maxTrack) + 5;
                }
            }

            // 3. 调 node render.js → 静音视频（渲染到临时目录 silent.<fmt>，音轨由最终混流独立混入）。
            // 产物文件名用标题（清洗非法字符，空/纯非法回退 recommend），同名自动追加 -N 防覆盖。
            Path out = uniqueExportName(title, fmt);
            Path silent = work.resolve("silent." + fmt);
            var cmd = new java.util.ArrayList<String>();
            cmd.add(nodePath);
            cmd.add("render.js");
            cmd.add("--html");
            cmd.add(html.toAbsolutePath().toString());
            cmd.add("--out");
            cmd.add(silent.toAbsolutePath().toString());
            cmd.add("--width");
            cmd.add(String.valueOf(wh[0]));
            cmd.add("--height");
            cmd.add(String.valueOf(wh[1]));
            cmd.add("--duration");
            cmd.add(String.valueOf(renderDurationSeconds));
            cmd.add("--format");
            cmd.add(fmt);
            cmd.add("--chrome");
            cmd.add(chromePath);
            cmd.add("--ffmpeg");
            cmd.add(ffmpegPath);
            // 不再传 --bgm：render.js 只输出静音视频（音画解耦，录制过程不接触真实音频）
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(resolveScriptsDir().toFile());
            pb.redirectErrorStream(true);

            log.info("渲染推荐视频: {} 部, {} ({}x{}), 预计 {}s, node={}, chrome={}, scripts={}",
                    ids.size(), resolution, wh[0], wh[1], durationSeconds, nodePath, chromePath, scriptsDir);
            long t0 = System.currentTimeMillis();
            Process p = pb.start();
            String output = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            boolean finished = p.waitFor(RENDER_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            if (!finished) {
                p.destroyForcibly();
                throw new IllegalStateException("视频渲染超时（>" + RENDER_TIMEOUT_SECONDS + "s）");
            }
            if (p.exitValue() != 0) {
                log.error("render.js 失败退出 {}:\n{}", p.exitValue(), output);
                throw new IllegalStateException("视频渲染失败（node 退出 " + p.exitValue() + "）: "
                        + lastLines(output));
            }
            if (!Files.exists(silent) || Files.size(silent) < 1024) {
                log.error("静音视频产物为空:\n{}", output);
                throw new IllegalStateException("视频渲染失败（静音视频为空）");
            }
            log.info("静音视频渲染完成 {}（{}s，{}KB）", silent.getFileName(),
                    (System.currentTimeMillis() - t0) / 1000.0, Files.size(silent) / 1024);

            // 4. 最终混流：静音视频 + BGM 音轨（-stream_loop 循环铺满）→ 成品。
            // 视频流 -c:v copy 不重编码（帧率/时长/画质不变）；音频以视频时长为硬边界 -shortest 裁掉循环超出部分。
            if (bgmFile != null) {
                var mx = new java.util.ArrayList<String>();
                mx.add(ffmpegPath);
                mx.add("-y");
                mx.add("-i"); mx.add(silent.toAbsolutePath().toString());
                mx.add("-stream_loop"); mx.add("-1"); mx.add("-i"); mx.add(bgmFile);
                mx.add("-map"); mx.add("0:v:0");
                mx.add("-map"); mx.add("1:a:0");
                mx.add("-c:v"); mx.add("copy");
                mx.add("-c:a"); mx.add(fmt.equals("webm") ? "libopus" : "aac");
                mx.add("-shortest");
                mx.add(out.toAbsolutePath().toString());
                ProcessBuilder pm = new ProcessBuilder(mx);
                pm.redirectErrorStream(true);
                Process pm2 = pm.start();
                String mout = new String(pm2.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                int mrc = pm2.waitFor();
                if (mrc != 0) {
                    log.error("最终混流失败 {}:\n{}", mrc, mout);
                    throw new IllegalStateException("视频最终混流失败（ffmpeg 退出 " + mrc + "）");
                }
            } else {
                Files.move(silent, out, StandardCopyOption.REPLACE_EXISTING);
            }

            long elapsed = System.currentTimeMillis() - t0;
            if (!Files.exists(out) || Files.size(out) < 1024) {
                log.error("最终产物为空:\n{}", output);
                throw new IllegalStateException("视频渲染失败（最终产物为空）");
            }
            log.info("渲染完成 {}（{}s，{}KB）", out.getFileName(), elapsed / 1000.0,
                    Files.size(out) / 1024);
            return out;
        } catch (IOException e) {
            throw new IllegalStateException("视频渲染启动失败（工具链/IO）: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("视频渲染被中断", e);
        } finally {
            if (html != null) {
                deleteTree(html.getParent());
            }
        }
    }

    /** 导出产物持久目录：data/exports（相对应用工作目录，自动创建）。产物存这里可被异步任务记录/打开/删除。 */
    private Path exportDir() throws IOException {
        Path d = Paths.get("data", "exports").toAbsolutePath();
        Files.createDirectories(d);
        return d;
    }

    /** 产物文件名：{标题}.{fmt}，标题清洗 Windows 非法字符、空/纯非法字符回退 recommend；同名已存在则追加 -N 防覆盖。 */
    private Path uniqueExportName(String title, String fmt) throws IOException {
        String base = title == null ? "" : title.trim()
                .replaceAll("[\\\\/:*?\"<>|]", "")   // Windows 不允许 \ / : * ? " < > |
                .replaceAll("[\\s.]+$", "");          // 去掉首尾空白/点（Windows 尾点/空格非法）
        if (base.isBlank()) {
            base = "recommend";
        }
        Path dir = exportDir();
        Path out = dir.resolve(base + "." + fmt);
        for (int n = 2; out.toFile().exists(); n++) {
            out = dir.resolve(base + "-" + n + "." + fmt);
        }
        return out;
    }

    /**
     * chapter 样式：Remotion 逐帧渲染（产物带素材原声）+ 最终 BGM 混流。
     *
     * 与旧链路（Puppeteer 实时录屏 → 静音视频 → BGM 铺满）的区别：
     * Remotion 产物**自带原声**，所以 BGM 由「铺满」改为「与原声混合」（设计规格 §8.3）。
     */
    private Path renderWithRemotion(Path work, List<Long> ids, String title, String fmt, int[] wh, String bgmFile,
                                    List<RecommendService.BgmTrack> bgmTracks, String subtitle, String coverSize,
                                    String groupBy, String groupStyle, List<Long> openingIds, String intro,
                                    RecommendService.Durations durations, String endingTitle, String endingText,
                                    String bgColor, List<String> bgImages, Integer bgRotationSec, Integer bgOpacity,
                                    Integer bgBlur, Integer bgBrightness, String prologueTitle, String groupSort,
                                    Integer openingSpeed, Integer endingScrollSpeed, Integer bgmScale, Integer bgmX,
                                    Integer bgmY, String brandTitle, Integer perScreen, Map<String, Boolean> detailShow,
                                    Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips) throws IOException {
        Path remotion = resolveRemotionDir();
        if (remotion == null) {
            throw new IllegalStateException("未找到 Remotion 工程（期望 <remotion-dir>/scripts/render-recommend.ts，"
                    + "当前配置 " + remotionDir + "）");
        }

        String inputJson = recommendService.buildRenderInput(ids, title, bgmTracks, subtitle, coverSize, groupBy,
                groupStyle, openingIds, intro, durations, endingTitle, endingText, bgColor, bgImages, bgRotationSec,
                bgOpacity, bgBlur, bgBrightness, prologueTitle, groupSort, openingSpeed, endingScrollSpeed, bgmScale,
                bgmX, bgmY, brandTitle, perScreen, detailShow, preparedClips, "embed", 30, wh[0], wh[1],
                rel -> probeMediaDuration(work.resolve(rel).toAbsolutePath().toString()));
        Path inputFile = work.resolve("render-input.json");
        Files.writeString(inputFile, inputJson, StandardCharsets.UTF_8);
        Path rendered = work.resolve("rendered." + fmt);
        Path out = uniqueExportName(title, fmt);

        var cmd = new ArrayList<String>();
        cmd.add(nodePath);
        cmd.add(remotion.resolve("node_modules/tsx/dist/cli.mjs").toAbsolutePath().toString());
        cmd.add(remotion.resolve("scripts/render-recommend.ts").toAbsolutePath().toString());
        cmd.add("--input"); cmd.add(inputFile.toAbsolutePath().toString());
        cmd.add("--output"); cmd.add(rendered.toAbsolutePath().toString());
        cmd.add("--asset-root"); cmd.add(work.toAbsolutePath().toString());
        cmd.add("--format"); cmd.add(fmt);
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(remotion.toFile());
        pb.redirectErrorStream(true);
        log.info("Remotion 渲染推荐视频: {} 部, {}x{}, node={}, remotion={}", ids.size(), wh[0], wh[1], nodePath, remotion);
        long t0 = System.currentTimeMillis();
        Process p = pb.start();
        String output = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        boolean finished;
        try {
            finished = p.waitFor(RENDER_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            p.destroyForcibly();
            throw new IllegalStateException("Remotion 渲染被中断", e);
        }
        if (!finished) {
            p.destroyForcibly();
            throw new IllegalStateException("Remotion 渲染超时（>" + RENDER_TIMEOUT_SECONDS + "s）");
        }
        if (p.exitValue() != 0) {
            log.error("Remotion 渲染失败 {}:\n{}", p.exitValue(), output);
            throw new IllegalStateException("Remotion 渲染失败（node 退出 " + p.exitValue() + "）: " + lastLines(output));
        }
        if (!Files.exists(rendered) || Files.size(rendered) < 1024) {
            log.error("Remotion 产物为空:\n{}", output);
            throw new IllegalStateException("Remotion 渲染失败（产物为空）");
        }
        log.info("Remotion 渲染完成 {}（{}s，{}KB）", rendered.getFileName(),
                (System.currentTimeMillis() - t0) / 1000.0, Files.size(rendered) / 1024);

        // 最终混流：无 BGM → 直接用（原声已在产物里）；有 BGM → 原声 + BGM 混合
        if (bgmFile == null) {
            Files.move(rendered, out, StandardCopyOption.REPLACE_EXISTING);
        } else {
            boolean hasAudio = probeHasAudio(rendered.toAbsolutePath().toString());
            if (hasAudio) {
                List<String> mixed = runMix(remotionMixCommand(rendered, bgmFile, out, fmt, true));
                if (mixed == null) {
                    log.warn("原声+BGM 混合失败，回退为 BGM 铺满（产物音轨可能缺失）");
                    if (runMix(remotionMixCommand(rendered, bgmFile, out, fmt, false)) == null) {
                        throw new IllegalStateException("Remotion 最终混流失败（ffmpeg）");
                    }
                }
            } else if (runMix(remotionMixCommand(rendered, bgmFile, out, fmt, false)) == null) {
                throw new IllegalStateException("Remotion 最终混流失败（ffmpeg）");
            }
        }
        if (!Files.exists(out) || Files.size(out) < 1024) {
            throw new IllegalStateException("Remotion 渲染失败（最终产物为空）");
        }
        log.info("Remotion 导出完成 {}（{}KB）", out.getFileName(), Files.size(out) / 1024);
        return out;
    }

    /** Remotion 产物 + BGM → 成品。mixWithOriginal=true → 原声与 BGM 混合（BGM 压低到 45%）；false → BGM 铺满。 */
    private List<String> remotionMixCommand(Path rendered, String bgmFile, Path out, String fmt, boolean mixWithOriginal) {
        List<String> mx = new ArrayList<>();
        mx.add(ffmpegPath);
        mx.add("-y");
        mx.add("-i"); mx.add(rendered.toAbsolutePath().toString());
        mx.add("-stream_loop"); mx.add("-1"); mx.add("-i"); mx.add(bgmFile);
        if (mixWithOriginal) {
            mx.add("-filter_complex");
            mx.add("[1:a]volume=0.45[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]");
            mx.add("-map"); mx.add("0:v:0");
            mx.add("-map"); mx.add("[aout]");
        } else {
            mx.add("-map"); mx.add("0:v:0");
            mx.add("-map"); mx.add("1:a:0");
        }
        mx.add("-c:v"); mx.add("copy");
        mx.add("-c:a"); mx.add(fmt.equals("webm") ? "libopus" : "aac");
        mx.add("-shortest");
        mx.add(out.toAbsolutePath().toString());
        return mx;
    }

    /** 跑一次 ffmpeg 混流；成功返回输出日志，失败返回 null（不抛，交给调用方决定回退）。 */
    private List<String> runMix(List<String> command) {
        try {
            ProcessBuilder pm = new ProcessBuilder(command);
            pm.redirectErrorStream(true);
            Process proc = pm.start();
            String logOutput = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            int rc = proc.waitFor();
            if (rc != 0) {
                // 首次尝试失败可能是预期内的（无音轨却走了 amix 分支）→ 用 WARN，由调用方决定回退
                log.warn("本次混流尝试失败 {}（详见日志尾部）", rc);
                log.debug("混流输出:\n{}", logOutput);
                return null;
            }
            return command;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.error("最终混流启动失败: {}", e.getMessage());
            return null;
        }
    }

    /** 探测文件是否含音轨（ffprobe 不可用/探测异常 → 按“有原声”处理，并依赖 amix 失败回退兜底）。 */
    private boolean probeHasAudio(String file) {
        try {
            Path ffprobe = ffprobePath();
            if (ffprobe == null) return true;
            ProcessBuilder pb = new ProcessBuilder(ffprobe.toString(), "-v", "error", "-select_streams", "a",
                    "-show_entries", "stream=index", "-of", "csv=p=0", file);
            pb.redirectErrorStream(true);
            Process pr = pb.start();
            String probeOut = new String(pr.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            pr.waitFor(30, TimeUnit.SECONDS);
            return !probeOut.isBlank();
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("音轨探测失败，按有原声处理（混流失败会回退）: {}", e.getMessage());
            return true;
        }
    }

    /** 定位 Remotion 工程目录（与 resolveScriptsDir 同理：IDE 与 mvn 的 cwd 不同）。 */
    private Path resolveRemotionDir() {
        List<Path> candidates = List.of(
                Paths.get(remotionDir),
                Paths.get(remotionDir).toAbsolutePath(),
                Paths.get("backend/remotion").toAbsolutePath(),
                Paths.get("../backend/remotion").toAbsolutePath(),
                Paths.get("remotion").toAbsolutePath());
        for (Path candidate : candidates) {
            if (Files.isRegularFile(candidate.resolve("scripts/render-recommend.ts"))) {
                return candidate.toAbsolutePath().normalize();
            }
        }
        return null;
    }

    /** 分辨率 → 像素（供预览等外部使用；未知/空 → 720P）。 */
    public static int[] pixelsOf(String resolution) {
        int[] wh = RESOLUTIONS.get(normalize(resolution == null || resolution.isBlank() ? "720P" : resolution));
        return wh == null ? RESOLUTIONS.get("720P") : wh;
    }

    /** 素材时长探测（秒）；探测不可用/失败返回 0。供预览组装 RenderInput 计算片段时长。 */
    public double probeDurationSeconds(String file) {
        return probeMediaDuration(file);
    }

    /** Remotion Player 预览页是否已构建（未构建时预览回退旧 HTML）。 */
    public boolean hasPlayerBundle() {
        Path remotion = resolveRemotionDir();
        return remotion != null && Files.isRegularFile(remotion.resolve("dist-player/player.html"))
                && Files.isRegularFile(remotion.resolve("dist-player/player.html"));
    }

    /** Player 预览页 HTML（已构建的 dist-player/player.html）。 */
    public Path playerPagePath() {
        Path remotion = resolveRemotionDir();
        return remotion == null ? null : remotion.resolve("dist-player/player.html");
    }

    /**
     * 定位 render.js 所在目录。配置值相对应用工作目录（IDE 从项目根、mvn 从 backend 启动，
     * 两者 cwd 不同），先按配置解析，找不到则按常见候选兜底，避免一种启动方式配置失效。
     */
    private Path resolveScriptsDir() {
        Path configured = Paths.get(scriptsDir);
        if (isRenderScript(configured)) {
            return configured;
        }
        List<Path> candidates = List.of(
                Paths.get(scriptsDir).toAbsolutePath(),
                Paths.get("backend/scripts").toAbsolutePath(),
                Paths.get("../backend/scripts").toAbsolutePath(),
                Paths.get("../scripts").toAbsolutePath(),
                Paths.get("scripts").toAbsolutePath(),
                // 桌面版打包：resources/scripts（electron-builder extraResources）。
                // jar 在 resources/app/ 下，cwd=resources/app → ../scripts = resources/scripts
                Paths.get("../scripts").toAbsolutePath(),
                Paths.get("../resources/scripts").toAbsolutePath(),
                Paths.get("resources/scripts").toAbsolutePath());
        for (Path p : candidates) {
            if (isRenderScript(p)) {
                log.warn("scripts-dir {} 下无 render.js，改用 {}", scriptsDir, p);
                return p;
            }
        }
        return configured;
    }

    private static void deleteTree(Path root) {
        if (root == null) return;
        try (var paths = Files.walk(root)) {
            paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                try { Files.deleteIfExists(path); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }
    private static boolean isRenderScript(Path dir) {
        return dir != null && Files.isRegularFile(dir.resolve("render.js"));
    }

    private static String normalize(String resolution) {
        return resolution == null ? null : resolution.trim().toUpperCase(Locale.ROOT);
    }

    private static String lastLines(String output) {
        if (output == null || output.isBlank()) {
            return "无输出";
        }
        String[] lines = output.split("\\R");
        int from = Math.max(0, lines.length - 8);
        return String.join(" | ", java.util.Arrays.copyOfRange(lines, from, lines.length));
    }

    /** BGM 时长数组 → JS 数组字面量（点小数，规避 Locale 逗号）。 */
    private static String bgmDursJson(List<Double> durs) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < durs.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(String.format(Locale.ROOT, "%.2f", durs.get(i)));
        }
        return sb.append(']').toString();
    }

    /** 探测音频/视频文件时长（秒）：优先 ffprobe（与 ffmpeg 同目录），回退 ffmpeg -i 解析。失败 → 0。 */
    private double probeMediaDuration(String file) {
        try {
            Path ffprobe = ffprobePath();
            if (ffprobe != null) {
                ProcessBuilder pb = new ProcessBuilder(ffprobe.toString(), "-v", "error",
                        "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file);
                pb.redirectErrorStream(true);
                Process p = pb.start();
                String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
                p.waitFor();
                if (!out.isEmpty()) {
                    return Double.parseDouble(out.trim().split("\\s+")[0]);
                }
            }
            // 回退：ffmpeg -i 解析 stderr 的 Duration: HH:MM:SS.cc
            ProcessBuilder pb = new ProcessBuilder(ffmpegPath, "-i", file);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            String err = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            p.waitFor();
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("Duration: (\\d{2}):(\\d{2}):(\\d{2}\\.?\\d*)").matcher(err);
            if (m.find()) {
                return Integer.parseInt(m.group(1)) * 3600 + Integer.parseInt(m.group(2)) * 60
                        + Double.parseDouble(m.group(3));
            }
        } catch (Exception e) {
            log.warn("探测 BGM 时长失败 {}: {}", file, e.getMessage());
        }
        return 0;
    }

    /** ffprobe 路径推导：与 ffmpeg 同目录、ffmpeg 换 ffprobe（存在才返回，否则 null 走 ffmpeg -i 回退）。 */
    /**
     * ffprobe 定位：优先配置的 ffprobe-path，否则取 ffmpeg-path 同目录同名文件。
     * 取不到 → 音轨探测按“有原声”处理，混流失败会自动回退（不阻断导出）。
     */
    private Path ffprobePath() {
        try {
            if (ffprobePath != null && !ffprobePath.isBlank()) {
                Path configured = Path.of(ffprobePath).toAbsolutePath();
                if (Files.isRegularFile(configured)) return configured;
                log.warn("配置的 ffprobe 不存在: {}（回退为按有原声处理）", ffprobePath);
            }
            Path ff = Path.of(ffmpegPath).toAbsolutePath();
            String name = ff.getFileName() == null ? "ffmpeg" : ff.getFileName().toString();
            String probeName = name.endsWith(".exe")
                    ? "ffprobe.exe" : "ffprobe";
            Path probe = ff.getParent().resolve(probeName);
            return Files.isRegularFile(probe) ? probe : null;
        } catch (Exception e) {
            return null;
        }
    }
}
