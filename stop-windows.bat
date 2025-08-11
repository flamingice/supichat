@echo off
echo Stopping SupiChat services...
echo.

REM Kill Node.js processes on ports 3000 and 4001
echo Stopping web app (port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Stopping signaling server (port 4001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4001') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo Services stopped!
echo If you still see command windows, you can close them manually.
pause
