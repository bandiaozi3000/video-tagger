@echo off
rem Video Tagger - Animeko live tagging global hotkey tray (standalone, no main UI)
rem Press Ctrl+Alt+T after start to open the tagging overlay.
rem Backend is expected at 127.0.0.1:8080 (your IDEA instance).
rem Optional env: VT_BACKEND_PORT (backend port), VT_TAG_HOTKEY (e.g. Control+Alt+K)
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
    echo [tag-tray] electron not found. Run: npm install electron@32.3.3
    pause
    exit /b 1
)

start "" "node_modules\electron\dist\electron.exe" "tag-tray.js" > tag-tray.log 2>&1
echo [tag-tray] Running in background. Press Ctrl+Alt+T to open Animeko tagging overlay.
echo            Exit: right-click tray icon -^> Exit. This window can be closed.
timeout /t 3 >nul
