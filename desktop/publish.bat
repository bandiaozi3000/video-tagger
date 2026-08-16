@echo off
setlocal EnableDelayedExpansion
rem ============================================================
rem  Video Tagger desktop publish script (generate latest.json)
rem  Run AFTER pack.bat. Computes SHA-256 of the fresh backend jar
rem  and writes a latest.json update manifest to release/.
rem  Then upload jar + latest.json to your update host.
rem  NOTE: keep this file pure ASCII (no Chinese) - bat GBK issue.
rem ============================================================

set "ROOT=%~dp0.."
set "OUT=%ROOT%\release"
set "URL_PLACEHOLDER=https://YOUR-UPDATE-HOST/path/video-tagger-backend.jar"

rem ---- 0. locate newest backend jar ----
set "JAR="
for /f "delims=" %%f in ('dir /b /o-d "%ROOT%\backend\target\video-tagger-backend-*.jar" 2^>nul') do (
  echo %%f | findstr /i /v "sources javadoc" >nul
  if not errorlevel 1 if not defined JAR set "JAR=%%f"
)
if not defined JAR ( echo [ERROR] no backend jar found. run pack.bat first. & pause & exit /b 1 )
echo [0/3] jar: %JAR%

rem ---- 1. ask version ----
set "VERSION="
set /p "VERSION=New version (e.g. 0.1.1): "
if "%VERSION%"=="" ( echo [ERROR] version required & pause & exit /b 1 )

rem ---- 2. sha256 + size ----
for /f "usebackq delims=" %%h in (`powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 -Path '%ROOT%\backend\target\%JAR%').Hash.ToLower()"`) do set "SHA=%%h"
for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "(Get-Item '%ROOT%\backend\target\%JAR%').Length"`) do set "SIZE=%%s"
if not defined SHA ( echo [ERROR] sha256 calc failed & pause & exit /b 1 )
echo [1/3] sha256: %SHA%
echo [2/3] size: %SIZE%

rem ---- 3. write latest.json ----
if not exist "%OUT%" mkdir "%OUT%"
>  "%OUT%\latest.json" echo {
>> "%OUT%\latest.json" echo   "version": "%VERSION%",
>> "%OUT%\latest.json" echo   "changelog": "",
>> "%OUT%\latest.json" echo   "backend": {
>> "%OUT%\latest.json" echo     "url": "%URL_PLACEHOLDER%",
>> "%OUT%\latest.json" echo     "sha256": "%SHA%",
>> "%OUT%\latest.json" echo     "size": %SIZE%
>> "%OUT%\latest.json" echo   }
>> "%OUT%\latest.json" echo }

echo [3/3] wrote %OUT%\latest.json
echo.
echo ============================================================
echo  DONE. Next steps:
echo   1. upload latest.json + the jar (rename to
echo      video-tagger-backend.jar) to your update host
echo   2. edit latest.json: fill backend.url with the real jar URL
echo      and changelog (UTF-8)
echo   3. set "updateUrl" in desktop\package.json to the manifest
echo      URL, rebuild zip (pack.bat) so clients can check updates
echo ============================================================
pause
