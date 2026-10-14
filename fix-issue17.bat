@echo off
setlocal enabledelayedexpansion
title Fix Issue17 - Prisma Regenerate + Backend Restart
chcp 65001 >nul

rem ============================================================
rem   fix-issue17.bat
rem   Purpose: Reset CrmOpportunity.attachments prisma client lock.
rem     1) Kill any node holding backend port 3001
rem     2) Remove the stale .dll/.tmp in .prisma/client
rem     3) Run `npx prisma generate` (so .js/.d.ts/.dll all match DB)
rem     4) Start backend
rem
rem   Usage: double-click this file in D:\github\xiangmutest\opencode\zhibang
rem ============================================================

echo.
echo === Fix Issue17: prisma regenerate + backend restart ===
echo.

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

rem ----- 1. Kill stale node on port 3001 -----
echo [1/4] Killing stale process on port 3001 ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo   killing PID %%a
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 >nul

rem ----- 2. Clean .tmp leftovers in .prisma/client -----
echo [2/4] Cleaning stale .tmp files in .prisma/client ...
if exist "%BACKEND%\node_modules\.prisma\client" (
    del /q "%BACKEND%\node_modules\.prisma\client\*.tmp*" >nul 2>&1
)
echo   done.
echo.

rem ----- 3. prisma generate (now .dll is not locked) -----
echo [3/4] Running `npx prisma generate` in backend ...
pushd "%BACKEND%"
call npx prisma generate
set "GEN_RC=%errorlevel%"
popd
if not "%GEN_RC%"=="0" (
    echo.
    echo   [ERROR] prisma generate failed (rc=%GEN_RC%). Aborting.
    pause
    exit /b 1
)
echo.

rem ----- 4. Start backend -----
echo [4/4] Starting backend on port 3001 ...
start "Zhibang Backend (issue17 fix)" cmd /k "D:\github\xiangmutest\opencode\zhibang\backend\start-backend.bat"
echo   backend launched in new window.
echo.

echo ============================================================
echo   Open browser: http://127.0.0.1:8080/
echo   Login: admin / 123456
echo   Expected:
echo     - /api/project/list  returns 200 with rows
echo     - /api/worklog       returns 200 with rows
echo     - E2E: 275 OK / 0 FAIL
echo ============================================================
echo.
echo Press any key to close this window ...
pause >nul
