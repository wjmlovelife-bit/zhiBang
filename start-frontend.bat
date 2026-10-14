@echo off
title Zhibang Frontend
echo ============================================================
echo   Zhibang Frontend static server  ( port 8080 )
echo ============================================================
echo.
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
echo Working dir: %SCRIPT_DIR%
echo.
set "NODE_EXE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
if not exist "%NODE_EXE%" (
    for /f "delims=" %%i in ('where node 2^>nul') do set "NODE_EXE=%%i"
)
if not exist "%NODE_EXE%" (
    echo [ERROR] node.exe not found at "%NODE_EXE%"
    pause
    exit /b 1
)
echo Using node: "%NODE_EXE%"
echo.
"%NODE_EXE%" serve-frontend.mjs
echo.
echo frontend exited.
pause
