@echo off
rem -------------------------------------------------------------------
rem  This file is intentionally ASCII-only.
rem  cmd.exe parses a .bat with the codepage that is active when the line
rem  is read, so Korean text inside a UTF-8 .bat gets garbled. All Korean
rem  wording is printed by Node instead (scripts/seed-report.ts), which
rem  writes proper UTF-8 to a console switched to codepage 65001 below.
rem -------------------------------------------------------------------
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo ==============================================================
echo   Audit Context AI  /  Stage 0 check
echo ==============================================================
echo.
echo   [1/2] npm test        - trust checks
echo   [2/2] npm run report  - golden dataset, human readable
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node

call npm test
if errorlevel 1 goto failed

echo.
call npm run seed:report
call npm run seed:report > report.txt 2>&1

echo.
echo ==============================================================
echo   OK. Also saved to:  report.txt
echo ==============================================================
echo.
pause
exit /b 0

:no_node
echo.
echo   [ERROR] Node.js not found. Install Node.js 22.6 or newer.
echo           https://nodejs.org
echo.
pause
exit /b 1

:failed
echo.
echo ==============================================================
echo   [FAILED] Some checks did not pass.
echo   Copy the messages above and send them to Claude Code as-is.
echo ==============================================================
echo.
pause
exit /b 1
