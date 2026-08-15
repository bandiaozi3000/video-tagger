@echo off
setlocal EnableDelayedExpansion
rem ============================================================
rem  Video Tagger desktop one-click package script
rem  Output: <project-root>/release/video-tagger-desktop-0.1.0.zip
rem  Bundles node + ffmpeg + jre, so target machine needs nothing
rem  except Chrome. Double-click to run; safe from any cwd.
rem ============================================================

set "DESK=%~dp0"
set "ROOT=%~dp0.."
set "NODE_VERSION=v22.20.0"
set "ZIP_NAME=video-tagger-desktop-0.1.0.zip"

rem ---- 0. locate maven (Maven wrapper dist, find the one with mvn.cmd) ----
set "MVN_SET="
for /f "delims=" %%d in ('dir /b /ad "%USERPROFILE%\.m2\wrapper\dists\apache-maven-3.9.9-bin" 2^>nul') do (
  if not defined MVN_SET if exist "%USERPROFILE%\.m2\wrapper\dists\apache-maven-3.9.9-bin\%%d\apache-maven-3.9.9\bin\mvn.cmd" (
    set "PATH=%USERPROFILE%\.m2\wrapper\dists\apache-maven-3.9.9-bin\%%d\apache-maven-3.9.9\bin;%PATH%"
    set "MVN_SET=1"
  )
)
where mvn >nul 2>nul
if errorlevel 1 (
  echo [ERROR] mvn not found in Maven wrapper dists.
  echo         Install maven or set MVN_HOME, then re-run.
  pause
  exit /b 1
)

rem ---- 1. build backend fat jar ----
echo [1/6] building backend jar ...
pushd "%ROOT%\backend"
call mvn -q package -Dmaven.test.skip=true
if errorlevel 1 ( popd & echo [ERROR] mvn package failed & pause & exit /b 1 )
popd

rem ---- 2. pick newest jar, copy to resources/app (fixed name read by electron-builder) ----
echo [2/6] copy jar ...
set "JAR="
for /f "delims=" %%f in ('dir /b /o-d "%ROOT%\backend\target\video-tagger-backend-*.jar" 2^>nul') do (
  echo %%f | findstr /i /v "sources javadoc" >nul
  if not errorlevel 1 if not defined JAR set "JAR=%%f"
)
if not defined JAR ( echo [ERROR] no backend jar found under backend\target & pause & exit /b 1 )
if not exist "%DESK%resources\app" mkdir "%DESK%resources\app"
copy /y "%ROOT%\backend\target\%JAR%" "%DESK%resources\app\video-tagger-backend.jar" >nul
echo        jar: %JAR%

rem ---- 3. node runtime (bundled; download win-x64 zip if missing) ----
echo [3/6] node runtime ...
if not exist "%DESK%resources\node\node.exe" (
  echo        downloading node %NODE_VERSION% ...
  curl -sL --max-time 300 -o "%TEMP%\node-%NODE_VERSION%-win-x64.zip" "https://npmmirror.com/mirrors/node/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip"
  if errorlevel 1 (
    echo        npmmirror failed, trying official nodejs.org ...
    curl -sL --max-time 300 -o "%TEMP%\node-%NODE_VERSION%-win-x64.zip" "https://nodejs.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip"
  )
  if errorlevel 1 ( echo [ERROR] node download failed & pause & exit /b 1 )
  echo        extracting ...
  if exist "%TEMP%\node-extract" rmdir /s /q "%TEMP%\node-extract"
  powershell -NoProfile -Command "Expand-Archive -Force -Path '%TEMP%\node-%NODE_VERSION%-win-x64.zip' -DestinationPath '%TEMP%\node-extract'"
  if not exist "%DESK%resources\node" mkdir "%DESK%resources\node"
  xcopy /e /y /q "%TEMP%\node-extract\node-%NODE_VERSION%-win-x64\*" "%DESK%resources\node\" >nul
  del /q "%TEMP%\node-%NODE_VERSION%-win-x64.zip" 2>nul
  rmdir /s /q "%TEMP%\node-extract" 2>nul
)
echo        node: %DESK%resources\node\node.exe

rem ---- 4. ffmpeg (bundled; copy from tools\ffmpeg.exe if missing) ----
echo [4/6] ffmpeg ...
if not exist "%DESK%resources\ffmpeg.exe" (
  if exist "%ROOT%\tools\ffmpeg.exe" (
    copy /y "%ROOT%\tools\ffmpeg.exe" "%DESK%resources\ffmpeg.exe" >nul
  ) else (
    echo [ERROR] ffmpeg.exe not found. put a win-x64 ffmpeg at tools\ffmpeg.exe
    pause
    exit /b 1
  )
)

rem ---- 5. jre check ----
if not exist "%DESK%resources\jre\bin\java.exe" (
  echo [ERROR] resources\jre missing. copy a full JRE 17 to desktop\resources\jre
  pause
  exit /b 1
)

rem ---- 6. electron-builder (skip signing; use distN if old dist is locked) ----
echo [5/6] electron-builder ...
if not exist "%DESK%node_modules\.bin\electron-builder.cmd" (
  echo [ERROR] electron-builder not installed. run:  cd desktop ^&^& npm install
  pause
  exit /b 1
)
pushd "%DESK%"
set "OUTDIR=dist"
if exist "%DESK%dist" rmdir /s /q "%DESK%dist" 2>nul
if exist "%DESK%dist" goto :bump_out
goto :out_done
:bump_out
set /a N=2
:find_out_again
if exist "%DESK%dist!N!" ( set /a N+=1 & goto :find_out_again )
set "OUTDIR=dist!N!"
:out_done
call "%DESK%node_modules\.bin\electron-builder.cmd" --win --x64 --config.win.signAndEditExecutable=false --config.directories.output=%OUTDIR%
if errorlevel 1 ( popd & echo [ERROR] electron-builder failed & pause & exit /b 1 )
popd

rem ---- 7. rename win-unpacked to VideoTagger/ + compress release zip ----
echo [6/6] packaging release zip ...
if exist "%ROOT%\release" rmdir /s /q "%ROOT%\release"
mkdir "%ROOT%\release"
move "%DESK%!OUTDIR!\win-unpacked" "%ROOT%\release\VideoTagger" >nul
powershell -NoProfile -Command "Compress-Archive -Force -Path '%ROOT%\release\VideoTagger' -DestinationPath '%ROOT%\release\%ZIP_NAME%'"

echo.
echo ============================================================
echo  DONE: %ROOT%\release\%ZIP_NAME%
echo  (unzip, run Video Tagger.exe, data stays in unzip-root data/)
echo ============================================================
pause
