@echo off
setlocal
cd /d "%~dp0"
title FiveM Faction Community Server

echo ==========================================
echo   FiveM Faction Community Server
echo ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Install Node.js 18 or newer and run this file again.
    pause
    exit /b 1
)

echo [INFO] Checking Windows Firewall...
netsh advfirewall firewall show rule name="FiveM Faction Community 3000" >nul 2>&1
if errorlevel 1 (
    echo [INFO] A firewall rule is missing.
    echo [INFO] Requesting administrator permission to allow port 3000...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c netsh advfirewall firewall add rule name=""FiveM Faction Community 3000"" dir=in action=allow protocol=TCP localport=3000' -Verb RunAs -Wait"
)

if not exist "node_modules" (
    echo.
    echo [1/2] Installing required packages...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo [2/2] Starting server...
echo.
echo LAN addresses:
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    for /f "tokens=* delims= " %%B in ("%%A") do echo   http://%%B:3000
)
echo.
echo Open one of the addresses above on a phone connected to the same Wi-Fi.
echo Example: http://192.168.0.15:3000
echo.
echo Keep this window open while using the website.
echo Press Ctrl+C to stop the server.
echo.

call npm start
pause
