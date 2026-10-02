package com.videotagger.controller;

import com.videotagger.AbstractMySqlIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 静态资源必须**回源校验**（`Cache-Control: no-cache`）—— 2026-10-02 事故的回归门禁。
 *
 * <p>为什么钉这条：当天改了约千行 `app.js` 并把 `#tag-sync-all` / `#tag-media-select` 从 HTML 删掉，
 * 但忘了提版本戳；浏览器拿着**缓存的旧 app.js** 撞上新 HTML → 旧 JS 在模块顶层
 * `getElementById(...).addEventListener` 拿到 null 抛异常 → **整个 app.js 停止执行**，
 * 全站只剩「加载失败：后端未响应」（后端其实全是 200）。实测旧实例响应里既没有
 * `Cache-Control` 也没有 `ETag`，浏览器可以不回源。
 *
 * <p>修法是 `application.yml` 的 `spring.web.resources.cache.cachecontrol.no-cache: true`。
 * 本测试保证这个开关**不会被以后谁顺手删掉**（删了这里立刻红）。
 */
@AutoConfigureMockMvc
class StaticResourceCacheIT extends AbstractMySqlIT {

    @Autowired
    MockMvc mvc;

    @Test
    void appJsMustRevalidate() throws Exception {
        mvc.perform(get("/app.js"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-cache")));
    }

    @Test
    void appCssMustRevalidate() throws Exception {
        mvc.perform(get("/app.css"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-cache")));
    }

    @Test
    void indexHtmlMustRevalidate() throws Exception {
        // HTML 上是带版本戳的（app.js?v=…），HTML 自己被缓存就等于「戳也一起失效了」——所以这条最关键
        mvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-cache")));
    }
}
