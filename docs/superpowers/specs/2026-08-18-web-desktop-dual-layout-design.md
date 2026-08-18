# Web / 桌面双布局设计（路线 B：HTML 双结构）

- **日期**：2026-08-18
- **状态**：已实施 + 验证通过（2026-08-18）
- **背景**：桌面版（Electron 壳）上线时把前端整个重构成了「shell」布局（自定义标题栏 + 左侧导航 + 底部状态栏），**web 浏览器打开也是这套**——原 web 布局（顶部 site-header + 横向 nav + 居中 container + 页脚）的 HTML 被删、CSS 被桌面规则压住（`.site-footer { display:none }`）。用户要求：**web 恢复原布局，桌面保持现状，功能同步**。

## 目标
1. **web（浏览器，无 window.vtDesktop）**：恢复原版布局 = 顶部 `.site-header`（logo + 横向 `.nav-tabs` + 设置 ⚙）+ 居中 `main.container`（max-width 1120px）+ `.site-footer`。不显示 titlebar / sidebar / statusbar。
2. **桌面（Electron，window.vtDesktop 存在）**：保持现状 = `.titlebar` + `.sidebar` + `.statusbar` 壳布局。
3. **功能同步**：同一份 JS，`showView`/tab 点击/设置弹窗在两种布局下都正常。

## 现状核查（读码结论）
- 原 web CSS 全部健在：`.site-header`（sticky 顶栏）、`.header-inner`、`.logo-wrap`、`.nav-tabs`（横向胶囊）、`.settings-btn`、`.site-footer`、`.container`（max-width 1120px）。只是 HTML 被桌面壳替换、`.site-footer{display:none}`（app.css:2213）压住。
- **JS 对布局结构零依赖**：无 `.shell`/`.main-body`/`.sidebar`/`.statusbar` 查询；`showView` 与 tab 点击都用 `querySelectorAll('.nav .tab')`（双导航天然兼容）。唯一雷点：`settings-btn` 用 `getElementById`（app.js:6508）——双按钮不能重复 id。
- 死代码：`?appMode=recommend` 的 `RECOMMEND_DESKTOP_MODE` 分支（app.js:16/481/3127/6521）无任何入口触发，保留不清理（避免误伤）。

## 结构设计（index.html）
```
<body>
  <div id="site-bg"> <div class="bg-fx">          ← 背景层（不动）
  <header class="titlebar">                        ← 桌面：grid row1；web：display:none
  <aside class="sidebar">                          ← 桌面：grid row2 col1；web：display:none
      <nav class="nav"> 7 tab（无 id）+ 创作分组 + recommend </nav>
      <div class="side-footer"><button id="settings-btn-side" class="settings-btn">设置</button></div>
  </aside>
  <header class="site-header">                     ← web：顶部；桌面：display:none
      <div class="container header-inner">
          <div class="logo-wrap">✦ VideoTagger <span class="ver-chip">v0.18.2</span></div>
          <nav class="nav"><div class="nav-tabs"> 7 tab </div>
              <button id="settings-btn" class="settings-btn">⚙</button></nav>
      </div>
  </header>
  <main class="container"> ...全部 view（共享，不动）... </main>
  <footer class="statusbar"> sb-* </footer>        ← 桌面：grid row3；web：display:none
  <footer class="site-footer"> Video Tagger · ... </footer>  ← web：页脚；桌面：display:none
</body>
```
- 去 `.shell` / `.main-body` 包裹层；main.container 变 body 直接子级（共享）。
- web 导航 tab 标签用原版：搜索/媒体/时间线/统计/标签/收藏夹/推荐（原版"推荐"，非"推荐导出"）。
- 桌面 sidebar 的 settings-btn id 改 `settings-btn-side`（避免与 web 的 `settings-btn` 重复）。

## CSS 设计（app.css）
- 默认（web）：`.titlebar/.sidebar/.statusbar { display:none }`；`.site-header/.site-footer` 正常显示；main.container 走原 `.container` 居中。
- 桌面（body.desktop-mode）：body 变 **grid**（`grid-template-rows:44px 1fr 30px; grid-template-columns:176px 1fr; height:100vh; overflow:hidden`）：
  - `.titlebar` → row1 col1/-1（display:flex）
  - `.sidebar` → row2 col1（display:flex）
  - `main.container` → row2 col2（max-width:none, overflow-y:auto）
  - `.statusbar` → row3 col1/-1（display:flex）
  - `.site-header/.site-footer` → display:none
- 移除 `.shell`、`.main-body` 两条死规则；`.site-footer{display:none}` 改 `body.desktop-mode .site-footer{display:none}`。

## JS 改动（app.js）
- 6508：`getElementById('settings-btn')` → `querySelectorAll('.settings-btn').forEach(b => b.addEventListener('click', openSettings))`（web 顶栏 ⚙ + 桌面侧栏设置都开设置弹窗）。

## 验证
1. web：复制 static → target，起后端 → 浏览器应显示顶部 header + 居中内容 + 页脚，无 titlebar/sidebar/statusbar。
2. 桌面：Electron 启动 → 应保持 titlebar + sidebar + statusbar 壳布局，tab/设置正常。
3. 两布局下 tab 切换、设置弹窗、响应式（720px media query）正常。
4. cache-bust：index.html 的 `?v=20260814a` → `?v=20260818a`。

## 关键文件
`backend/src/main/resources/static/index.html`、`app.css`、`app.js`；`desktop/main.js`（preload 注入 vtDesktop，不动）。
