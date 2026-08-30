@echo off
echo Stopping Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
echo Done.
pause
