@echo off
cd /d "%~dp0"

echo ==========================================
echo FiveM Faction Community Server
echo ==========================================
echo.

node --version >nul 2>&1
if errorlevel 1 goto NONODE

if not exist "node_modules" (
    echo Installing required packages...
    call npm install
    if errorlevel 1 goto NPMERROR
)

echo Starting server...
echo Open http://localhost:3000 in your browser.
echo Press Ctrl+C to stop the server.
echo.

call npm start
pause
exit /b

:NONODE
echo Node.js is not installed or is not in PATH.
echo Install Node.js 18 or newer, then run this file again.
pause
exit /b 1

:NPMERROR
echo npm install failed.
pause
exit /b 1
