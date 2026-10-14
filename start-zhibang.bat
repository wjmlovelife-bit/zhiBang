@echo off
title Start Zhibang CRM
echo ============================================================
echo   Start Zhibang CRM  ( PostgreSQL + Backend + Frontend )
echo ============================================================
echo.

if not exist D:\tmp mkdir D:\tmp
if not exist D:\OdooPG\logs mkdir D:\OdooPG\logs

echo [0/4] Kill stale node processes on ports 3001 / 5173 / 5174 / 8080 ...
for %%p in (3001 5173 5174 8080) do (
  for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p ^| findstr LISTENING') do (
    echo   port %%p -^> PID %%a, killing...
    taskkill /PID %%a /F >nul 2>&1
  )
)
timeout /t 2 >nul

echo.
echo [1/4] Starting PostgreSQL at D:\OdooPG ...
D:\OdooPG\bin\pg_ctl.exe -D D:\OdooPG\data -w -l D:\OdooPG\logs\pg_start.log start
if errorlevel 1 (
  echo   [WARN] pg_ctl returned error; PG may already be running or failed to start.
) else (
  echo   PostgreSQL start command issued.
)
echo   waiting for PostgreSQL on port 5432 ...
set PGOK=0
for /L %%i in (1,1,15) do (
  netstat -ano 2^>nul | findstr :5432 | findstr LISTENING >nul
  if not errorlevel 1 ( set PGOK=1 & goto :pgdone )
  timeout /t 1 >nul
)
:pgdone
if %PGOK%==1 ( echo   PostgreSQL is LISTENING on 5432. ) else ( echo   [ERROR] PostgreSQL did NOT come up. Check D:\OdooPG\logs\pg_start.log )

echo.
echo [2/4] Starting backend (Node, port 3001) ...
start "zhibang-backend" cmd /k "cd /d D:\github\xiangmutest\opencode\zhibang\backend && npm run start > D:\tmp\zhibang-backend.log 2>&1"

echo [3/4] Starting frontend static server (port 8080) ...
start "zhibang-frontend" cmd /k "cd /d D:\github\xiangmutest\opencode\zhibang && node serve-frontend.mjs > D:\tmp\zhibang-frontend.log 2>&1"

echo.
echo ============================================================
echo   Done. Open in browser:
echo     http://127.0.0.1:8080/
echo.
echo   This static server serves the built frontend and proxies
echo   /api to the backend (3001). Even if the backend is down,
echo   the page will still show (login will say "Backend unreachable").
echo.
echo   Login: admin / 123456   (or sales01 / 123456)
echo.
echo   Logs:
echo     D:\tmp\zhibang-backend.log
echo     D:\tmp\zhibang-frontend.log
echo ============================================================
echo.
pause
