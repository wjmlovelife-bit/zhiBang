@echo off
title Zhibang Backend
echo ============================================================
echo   Zhibang Backend  ( port 3001 )
echo ============================================================
echo.
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
echo Working dir: %SCRIPT_DIR%
echo.
npm run start
echo.
echo backend exited.
pause
