@echo off
setlocal enabledelayedexpansion
title Restart Zhibang CRM
chcp 65001 >nul
echo.
echo ============================================================
echo   Zhibang CRM Restart  ( PG + Backend 3001 + Frontend 8080 )
echo ============================================================
echo.

rem ----- 1. Prepare -----
if not exist D:\tmp mkdir D:\tmp
if not exist D:\OdooPG\logs mkdir D:\OdooPG\logs

set "NODE_EXE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
echo Using node: "%NODE_EXE%"
echo.

rem ----- 2. PostgreSQL -----
echo [1/4] PostgreSQL on 5432 ...
netstat -ano 2>nul | findstr ":5432" | findstr LISTENING >nul
if %errorlevel%==0 (
    echo   already running, skip.
) else (
    D:\OdooPG\bin\pg_ctl.exe -D D:\OdooPG\data -l D:\OdooPG\logs\pg_start.log start
    timeout /t 3 >nul
    echo   started. See D:\OdooPG\logs\pg_start.log
)
echo.

rem ----- 3. Kill stale processes -----
echo [2/4] Killing stale processes on 3001 / 5173 / 5174 / 8080 ...
for %%p in (3001 5173 5174 8080) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
        echo   killing PID %%a on port %%p
        taskkill /PID %%a /F >nul 2>&1
    )
)
echo   wait 3s for ports to release ...
timeout /t 3 >nul
echo.

rem ----- 4. Start backend (delegate to start-backend.bat, no nested quotes) -----
echo [3/4] Starting backend (port 3001) ...
start "Zhibang Backend" cmd /k "D:\github\xiangmutest\opencode\zhibang\backend\start-backend.bat"
echo   backend launched in new window "Zhibang Backend".
echo.

rem ----- 5. Start frontend (delegate to start-frontend.bat) -----
echo [4/4] Starting frontend static server (port 8080) ...
start "Zhibang Frontend" cmd /k "D:\github\xiangmutest\opencode\zhibang\start-frontend.bat"
echo   frontend launched in new window "Zhibang Frontend".
echo.

rem ----- 6. Health check -----
echo [check] probe http://127.0.0.1:8080/ ...
set HTTPOK=0
for /L %%i in (1,1,25) do (
    powershell -NoProfile -Command "try { (Invoke-WebRequest 'http://127.0.0.1:8080/' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 ( set HTTPOK=1 & goto :httpdone )
    timeout /t 1 >nul
)
:httpdone
if %HTTPOK%==1 (
    echo   [OK] 8080 is serving HTML.
) else (
    echo   [WARN] 8080 not yet responding. Check the "Zhibang Frontend" window.
)
echo.

echo ============================================================
echo   Open in browser:  http://127.0.0.1:8080/
echo   Login:            admin / 123456   or   sales01 / 123456
echo ============================================================
echo.
echo Press any key to close this window ...
pause >nul
