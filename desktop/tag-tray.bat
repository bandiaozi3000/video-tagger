@echo off
rem Video Tagger —— Animeko 现场打标全局热键托盘（常驻，无主界面）
rem 启动后按 Ctrl+Alt+T 弹出打标窗；后端默认 127.0.0.1:8080（IDEA 跑着即可）
rem 可选环境变量：VT_BACKEND_PORT（后端端口） VT_TAG_HOTKEY（换键）
cd /d "%~dp0"

rem 默认走本地 node_modules 的 electron；若没有则提示
if not exist "node_modules\electron\dist\electron.exe" (
    echo [tag-tray] 未找到 electron，先执行: npm install electron@32.3.3
    pause
    exit /b 1
)

start "" "node_modules\electron\dist\electron.exe" "tag-tray.js"
echo [tag-tray] 已在后台常驻：Ctrl+Alt+T 弹出 Animeko 打标窗。
echo           退出：右下角托盘图标右键 -^> 退出。本窗口可关闭。
timeout /t 3 >nul
