@echo off
REM 按 reqId 追踪一次请求的全链路日志（Windows 端版本）
REM 用法:
REM   scripts\tail-logs.bat                       REM 实时 tail 今天日志
REM   scripts\tail-logs.bat srv-5db3e773-...     REM grep reqId 全链路

set "LOGS_DIR=D:\github\xiangmutest\opencode\zhibang\backend\logs"
set "TODAY=%date:~0,10%"
set "TODAY=%TODAY:-=%"
set "LOG_FILE=%LOGS_DIR%\zhibang.%TODAY%.1.log"

if "%~1"=="" (
    if not exist "%LOG_FILE%" (
        echo No log file: %LOG_FILE%
        exit /b 1
    )
    echo === Real-time tail %LOG_FILE% ===
    powershell -NoProfile -Command "Get-Content '%LOG_FILE%' -Wait | ForEach-Object { try { $d=$_ | ConvertFrom-Json; $name = @{10='TRC';20='DBG';30='INF';40='WRN';50='ERR';60='FAL'}[$d.level]; if (-not $name) { $name = $d.level }; Write-Host (\"[{0}] {1} {2} - {3}\" -f $name, $d.reqId, $d.context, $d.msg) } catch { Write-Host $_ } }"
) else (
    echo === Grep reqId=%~1 ===
    findstr /S /C:"%~1" "%LOGS_DIR%\zhibang.*.log" 2>nul
)