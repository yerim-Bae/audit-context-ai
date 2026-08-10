@echo off
rem -------------------------------------------------------------------
rem  ASCII-only on purpose: cmd.exe garbles Korean text inside a UTF-8
rem  .bat file. Korean messages are printed by Node instead.
rem -------------------------------------------------------------------
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo ==============================================================
echo   Audit Context AI  /  BSP transaction map
echo ==============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node

echo   Building the screen...
call npm run build
if errorlevel 1 goto failed

echo.
echo   Starting local server. The browser opens automatically.
call npm start

goto end

:no_node
echo.
echo   [ERROR] Node.js not found. Install Node.js 22.6 or newer.
echo           https://nodejs.org
echo.
pause
exit /b 1

:failed
echo.
echo   [FAILED] Build failed. Copy the messages above and send them to Claude Code.
echo.
pause
exit /b 1

:end
pause
