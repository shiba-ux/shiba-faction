@echo off
setlocal
cd /d "%~dp0"
title Shiba Faction Community Server

echo ==========================================
echo   SHIBA FACTION COMMUNITY SERVER
echo ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Install Node.js 18 or newer and run again.
    pause
    exit /b 1
)

netsh advfirewall firewall show rule name="Shiba Faction Community 3000" >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c netsh advfirewall firewall add rule name=""Shiba Faction Community 3000"" dir=in action=allow protocol=TCP localport=3000' -Verb RunAs -Wait"
)

if not exist "node_modules" (
    echo Installing required packages...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo Starting website...
echo.
echo LAN addresses:
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    for /f "tokens=* delims= " %%B in ("%%A") do echo   http://%%B:3000
)
echo.
echo Open the LAN address above on a phone or another PC on the same Wi-Fi.
echo Keep this window open while the website is running.
echo.
call npm start
pause
