# Node.js Auto-Installer for SupiChat
# This script automatically downloads and installs Node.js if it's not already installed

param(
    [string]$NodeVersion = "20.11.1",
    [switch]$Force
)

Write-Host "SupiChat Node.js Auto-Installer" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# Check if Node.js is already installed
try {
    $nodeVersion = node --version
    if (-not $Force) {
        Write-Host "Node.js is already installed: $nodeVersion" -ForegroundColor Green
        Write-Host "Use -Force parameter to reinstall if needed." -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "Node.js is already installed: $nodeVersion" -ForegroundColor Yellow
        Write-Host "Force flag detected. Proceeding with reinstallation..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Node.js is not installed. Proceeding with installation..." -ForegroundColor Yellow
}

Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "Warning: This script is not running as Administrator." -ForegroundColor Yellow
    Write-Host "The installation may fail. Consider running PowerShell as Administrator." -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Do you want to continue anyway? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Installation cancelled." -ForegroundColor Red
        exit 1
    }
}

# Create temp directory for download
$tempDir = Join-Path $env:TEMP "supichat-nodejs-setup"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

Set-Location $tempDir

# Determine architecture
$arch = "x64"
if ([Environment]::Is64BitOperatingSystem -eq $false) {
    $arch = "x86"
    Write-Host "Warning: 32-bit Windows detected. This may cause compatibility issues." -ForegroundColor Yellow
}

# Download Node.js installer
Write-Host "Downloading Node.js v$NodeVersion ($arch)..." -ForegroundColor Yellow
$nodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-$arch.msi"
$installerPath = Join-Path $tempDir "nodejs-installer.msi"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Write-Host "Download URL: $nodeUrl" -ForegroundColor Gray
    
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($nodeUrl, $installerPath)
    
    if (-not (Test-Path $installerPath)) {
        throw "Download failed - file not found"
    }
    
    $fileSize = (Get-Item $installerPath).Length
    Write-Host "Download completed: $([math]::Round($fileSize / 1MB, 2)) MB" -ForegroundColor Green
    
} catch {
    Write-Host "Error: Failed to download Node.js installer" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check your internet connection" -ForegroundColor Gray
    Write-Host "2. Try running as Administrator" -ForegroundColor Gray
    Write-Host "3. Download manually from https://nodejs.org/" -ForegroundColor Gray
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Install Node.js silently
Write-Host "Installing Node.js..." -ForegroundColor Yellow
Write-Host "This may take a few minutes. Please wait..." -ForegroundColor Gray

try {
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $installerPath, "/quiet", "/norestart", "/log", "nodejs-install.log" -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "Node.js installation completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Node.js installation failed with exit code: $($process.ExitCode)" -ForegroundColor Red
        if (Test-Path "nodejs-install.log") {
            Write-Host "Check the log file: $((Get-Item nodejs-install.log).FullName)" -ForegroundColor Yellow
        }
        throw "Installation failed"
    }
} catch {
    Write-Host "Error during installation: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please install Node.js manually from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Wait for installation to complete and refresh environment
Write-Host "Refreshing environment variables..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Update PATH for current session
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
$nodejsPath = "$env:PROGRAMFILES\nodejs"
if ($env:PATH -notlike "*$nodejsPath*") {
    $env:PATH += ";$nodejsPath"
}

# Verify installation
Write-Host "Verifying installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "Node.js installed successfully!" -ForegroundColor Green
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan
    Write-Host "npm version: $npmVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Warning: Node.js installation may not be fully complete" -ForegroundColor Yellow
    Write-Host "You may need to restart your computer or open a new command prompt" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Clean up
Write-Host "Cleaning up temporary files..." -ForegroundColor Gray
if (Test-Path $installerPath) {
    Remove-Item $installerPath -Force
}
if (Test-Path "nodejs-install.log") {
    Remove-Item "nodejs-install.log" -Force
}

Write-Host ""
Write-Host "Installation process completed!" -ForegroundColor Green
Write-Host "You can now run SupiChat using start-windows.bat or start-windows.ps1" -ForegroundColor Cyan
Write-Host ""

# Return to original directory
if ($PSScriptRoot) {
    Set-Location $PSScriptRoot
}

Read-Host "Press Enter to exit"
