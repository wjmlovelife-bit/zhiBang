@echo off
title Zhibang CRM Diagnostics
echo ============================================================
echo   Zhibang CRM  Port / Process Diagnostics
echo ============================================================
echo.

echo [1] Node available?
where node >nul 2>&1 && (node -v) || (echo   [ERROR] node NOT on PATH)
echo.

echo [2] Port listening check (5432=PG, 3001=backend, 8080=static):
for %%p in (5432 3001 8080) do (
  set L=
  for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p ^| findstr LISTENING') do set L=%%a
  if defined L (echo   port %%p : LISTENING  PID=%L%) else (echo   port %%p : NOT listening)
)
echo.

echo [3] Local fetch test (does 8080 actually serve HTML?):
powershell -NoProfile -Command "try { $r=Invoke-WebRequest http://127.0.0.1:8080/ -UseBasicParsing -TimeoutSec 4; Write-Host ('  8080 -> HTTP '+ $r.StatusCode +'  bytes='+ $r.Content.Length) } catch { Write-Host ('  8080 -> FAIL: '+ $_.Exception.Message) }"
powershell -NoProfile -Command "try { $r=Invoke-WebRequest http://127.0.0.1:3001/ -UseBasicParsing -TimeoutSec 4; Write-Host ('  3001 -> HTTP '+ $r.StatusCode +'  bytes='+ $r.Content.Length) } catch { Write-Host ('  3001 -> FAIL: '+ $_.Exception.Message) }"
echo.

echo [4] Backend log tail (D:\tmp\zhibang-backend.log):
if exist D:\tmp\zhibang-backend.log (powershell -NoProfile -Command "Get-Content D:\tmp\zhibang-backend.log -Tail 20") else (echo   (no backend log yet))
echo.

echo [5] Frontend static log tail (D:\tmp\zhibang-frontend.log):
if exist D:\tmp\zhibang-frontend.log (powershell -NoProfile -Command "Get-Content D:\tmp\zhibang-frontend.log -Tail 20") else (echo   (no frontend log yet))
echo.

echo [6] PostgreSQL data dir / pg_ctl present?
if exist D:\OdooPG\bin\pg_ctl.exe (echo   pg_ctl.exe: OK) else (echo   [ERROR] pg_ctl.exe missing at D:\OdooPG\bin)
echo.
echo ============================================================
echo   Paste this whole output back to the assistant.
echo ============================================================
pause
