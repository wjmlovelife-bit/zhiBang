@echo off
setlocal
title Run Zhibang E2E Tests
chcp 65001 >nul
echo.
echo ============================================================
echo   Zhibang CRM - E2E Test Runner
echo ============================================================
echo.

set "NODE_EXE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-2\node.exe"
set "ROOT=D:\github\xiangmutest\opencode\zhibang"

echo [precheck] Node: "%NODE_EXE%"
if not exist "%NODE_EXE%" (
    echo   [ERROR] Node not found. Check the path above.
    pause
    exit /b 1
)

echo [precheck] Backend on 3001 ...
powershell -NoProfile -Command "try { (Invoke-WebRequest 'http://127.0.0.1:3001/api/auth/login' -Method POST -ContentType 'application/json' -Body '{\"username\":\"x\",\"password\":\"x\"}' -UseBasicParsing -TimeoutSec 3).StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Backend is NOT running on 3001.
    echo   Please run restart-zhibang.bat first.
    pause
    exit /b 1
)
echo   [OK] Backend reachable.
echo.

echo [1/2] Running all backend E2E tests ...
cd /d "%ROOT%\backend"
"%NODE_EXE%" test/run-all.mjs
set RC1=%errorlevel%
echo.
echo [2/2] Backstage results: exit code %RC1%
echo.

if %RC1%==0 (
    echo ============================================================
    echo   ALL E2E TESTS PASSED
    echo ============================================================
) else (
    echo ============================================================
    echo   SOME TESTS FAILED (exit %RC1%) - see output above
    echo ============================================================
)

echo.
pause
exit /b %RC1%
