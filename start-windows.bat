@echo off
setlocal EnableExtensions

echo Starting SupiChat for Windows...
echo.

echo [1/8] Checking for Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed. Installing Node.js automatically...
    echo.
    
    REM Create temp directory for download
    if not exist "%TEMP%\supichat-setup" mkdir "%TEMP%\supichat-setup"
    cd /d "%TEMP%\supichat-setup"
    
    REM Download Node.js installer
    echo Downloading Node.js installer...
    powershell -NoProfile -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile 'nodejs-installer.msi'}"
    
    if not exist "nodejs-installer.msi" (
        echo Error: Failed to download Node.js installer
        echo Please install Node.js manually from https://nodejs.org/
        pause
        exit /b 1
    )
    
    REM Install Node.js silently
    echo Installing Node.js...
    msiexec /i nodejs-installer.msi /quiet /norestart
    
    REM Wait for installation to complete (use PowerShell sleep for Git Bash compatibility)
    echo Waiting for installation to complete...
    powershell -NoProfile -Command "Start-Sleep -Seconds 30"
    
    REM Clean up installer
    del nodejs-installer.msi
    
    REM Return to original directory
    cd /d "%~dp0"
    
    REM Refresh environment variables
    echo Refreshing environment variables...
    call refreshenv.cmd 2>nul
    if errorlevel 1 (
        REM If refreshenv is not available, try to update PATH manually
        set PATH=%PATH%;%PROGRAMFILES%\nodejs
    )
)

REM Verify Node.js again
where node >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is still not available after installation.
    echo Tip: Try running the PowerShell starter instead: start-windows.ps1
    echo Or run: npm run dev:windows:ps
    pause
    exit /b 1
)
for /f "usebackq tokens=*" %%v in (`node --version`) do set NODE_V=%%v
echo Detected Node.js %NODE_V%

echo.
echo [2/8] Checking for npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo Error: npm is not installed or not in PATH
    echo Please restart your computer and try again
    pause
    exit /b 1
)
for /f "usebackq tokens=*" %%v in (`npm --version`) do set NPM_V=%%v
echo Detected npm %NPM_V%

echo.
echo [3/8] Installing root dependencies (if needed)...
if not exist "node_modules" (
    echo Running: npm install
    npm install
    if errorlevel 1 (
        echo Error: Failed to install root dependencies
        pause
        exit /b 1
    )
) else (
    echo Skipping, node_modules exists
)

echo.
echo [4/8] Installing web app dependencies (if needed)...
if not exist "apps\web\node_modules" (
    echo Running: (cd apps\web && npm install)
    pushd apps\web >nul
    npm install
    set ERR=%ERRORLEVEL%
    popd >nul
    if not "%ERR%"=="0" (
        echo Error: Failed to install web app dependencies
        pause
        exit /b 1
    )
) else (
    echo Skipping, apps\web\node_modules exists
)

echo.
echo [5/8] Installing signaling server dependencies (if needed)...
if not exist "services\signaling\node_modules" (
    echo Running: (cd services\signaling && npm install)
    pushd services\signaling >nul
    npm install
    set ERR=%ERRORLEVEL%
    popd >nul
    if not "%ERR%"=="0" (
        echo Error: Failed to install signaling server dependencies
        pause
        exit /b 1
    )
) else (
    echo Skipping, services\signaling\node_modules exists
)

echo.
echo [6/8] Preparing environment file...
if not exist "apps\web\.env.local" (
    if exist "apps\web\env.local.example" (
        echo Creating .env.local from example...
        copy /Y "apps\web\env.local.example" "apps\web\.env.local" >nul
    ) else (
        echo Warning: env.local.example not found. Proceeding without it.
    )
) else (
    echo Skipping, .env.local already exists
)

echo.
echo [7/8] Starting services...
echo Web app will be available at: http://localhost:3000
echo Signaling server will run on: http://localhost:4001
echo.
echo Press Ctrl+C to stop all services

echo Launching web app window...
start "SupiChat Web App" cmd /k "cd apps\web && npm run dev"

echo Launching signaling server window...
start "SupiChat Signaling Server" cmd /k "cd services\signaling && npm start"

echo.
echo [8/8] Opening browser...
powershell -NoProfile -Command "Start-Sleep -Seconds 3"
start http://localhost:3000

echo.
echo SupiChat is now running locally!
echo - Web app: http://localhost:3000
echo - Signaling server: http://localhost:4001

echo.
echo If windows did not open, try running: start-windows.ps1

echo.
pause
endlocal
