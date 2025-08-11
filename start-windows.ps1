# SupiChat Windows Startup Script (PowerShell)
# Run this script in PowerShell

Write-Host "Starting SupiChat for Windows..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Node.js is not installed. Installing Node.js automatically..." -ForegroundColor Yellow
    Write-Host ""
    
    # Create temp directory for download
    $tempDir = Join-Path $env:TEMP "supichat-setup"
    if (-not (Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    }
    
    Set-Location $tempDir
    
    # Download Node.js installer
    Write-Host "Downloading Node.js installer..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    $installerPath = Join-Path $tempDir "nodejs-installer.msi"
    
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath -UseBasicParsing
    } catch {
        Write-Host "Error: Failed to download Node.js installer" -ForegroundColor Red
        Write-Host "Please install Node.js manually from https://nodejs.org/" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    if (-not (Test-Path $installerPath)) {
        Write-Host "Error: Failed to download Node.js installer" -ForegroundColor Red
        Write-Host "Please install Node.js manually from https://nodejs.org/" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Install Node.js silently
    Write-Host "Installing Node.js..." -ForegroundColor Yellow
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $installerPath, "/quiet", "/norestart" -Wait -PassThru
    
    if ($process.ExitCode -ne 0) {
        Write-Host "Error: Node.js installation failed" -ForegroundColor Red
        Write-Host "Please install Node.js manually from https://nodejs.org/" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Wait a moment for installation to complete
    Write-Host "Waiting for installation to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # Clean up installer
    if (Test-Path $installerPath) {
        Remove-Item $installerPath -Force
    }
    
    # Return to original directory
    Set-Location $PSScriptRoot
    
    # Refresh environment variables
    Write-Host "Refreshing environment variables..." -ForegroundColor Yellow
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    $env:PATH += ";$env:PROGRAMFILES\nodejs"
    
    # Check if Node.js is now available
    try {
        $nodeVersion = node --version
        Write-Host "Node.js installed successfully! Version: $nodeVersion" -ForegroundColor Green
    } catch {
        Write-Host "Error: Node.js installation may have failed" -ForegroundColor Red
        Write-Host "Please restart your computer and try again, or install manually from https://nodejs.org/" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host ""
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Error: npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please restart your computer and try again" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Node.js and npm are ready!" -ForegroundColor Green
Write-Host ""

# Install root dependencies if node_modules doesn't exist
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing root dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install root dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Install web app dependencies if needed
if (-not (Test-Path "apps\web\node_modules")) {
    Write-Host "Installing web app dependencies..." -ForegroundColor Yellow
    Set-Location "apps\web"
    npm install
    Set-Location "..\.."
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install web app dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Install signaling server dependencies if needed
if (-not (Test-Path "services\signaling\node_modules")) {
    Write-Host "Installing signaling server dependencies..." -ForegroundColor Yellow
    Set-Location "services\signaling"
    npm install
    Set-Location "..\.."
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install signaling server dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Copy environment file if it doesn't exist
if (-not (Test-Path "apps\web\.env.local")) {
    if (Test-Path "apps\web\env.local.example") {
        Write-Host "Creating .env.local from example..." -ForegroundColor Yellow
        Copy-Item "apps\web\env.local.example" "apps\web\.env.local"
    }
}

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Green
Write-Host "Web app will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Signaling server will run on: http://localhost:4001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Function to start a service
function Start-Service {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDirectory
    )
    
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "cmd.exe"
    $processInfo.Arguments = "/c $Command"
    $processInfo.WorkingDirectory = $WorkingDirectory
    $processInfo.UseShellExecute = $true
    $processInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    $process.Start()
    
    return $process
}

# Start web app
Write-Host "Starting web app..." -ForegroundColor Yellow
$webProcess = Start-Service -Name "SupiChat Web App" -Command "npm run dev" -WorkingDirectory "apps\web"

# Start signaling server
Write-Host "Starting signaling server..." -ForegroundColor Yellow
$signalingProcess = Start-Service -Name "SupiChat Signaling Server" -Command "npm start" -WorkingDirectory "services\signaling"

Write-Host "Services started! Check the opened command windows for any errors." -ForegroundColor Green
Write-Host ""

# Wait a moment for services to start
Start-Sleep -Seconds 3

# Open browser
Write-Host "Opening web app in browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "SupiChat is now running locally!" -ForegroundColor Green
Write-Host "- Web app: http://localhost:3000" -ForegroundColor Cyan
Write-Host "- Signaling server: http://localhost:4001" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop the services, close the command windows or press Ctrl+C in each window." -ForegroundColor Yellow

# Keep the script running
Write-Host ""
Write-Host "Press Enter to exit this script (services will continue running)" -ForegroundColor Gray
Read-Host
