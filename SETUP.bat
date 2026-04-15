@echo off
title Light Finance CCTV - Setup

echo.
echo =====================================================
echo   Light Finance CCTV Monitoring Dashboard
echo   First-Time Setup
echo =====================================================
echo.

echo [1/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js is not installed on this computer.
    echo.
    echo  Please download and install Node.js from:
    echo    https://nodejs.org   ^(choose the LTS version^)
    echo.
    echo  After installing Node.js, run this SETUP.bat again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  Node.js found: %NODE_VER%
echo.

echo [2/4] Setting up pnpm package manager...
corepack enable pnpm >nul 2>&1
if errorlevel 1 (
    echo  Installing pnpm via npm...
    npm install -g pnpm
)
echo  pnpm ready.
echo.

echo [3/4] Installing dependencies (this may take a few minutes)...
call pnpm install
if errorlevel 1 (
    echo.
    echo  ERROR: Failed to install dependencies.
    echo  Check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo.

echo [4/4] Building application...
call pnpm --filter @workspace/api-server run build
if errorlevel 1 (
    echo.
    echo  ERROR: Failed to build the application.
    echo.
    pause
    exit /b 1
)
echo.

echo =====================================================
echo   Setup Complete!
echo =====================================================
echo.
echo  Database Branch_CCTV will be created automatically
echo  the first time you start the application.
echo.
echo  Next step: Double-click START.bat to launch the app.
echo.
pause
