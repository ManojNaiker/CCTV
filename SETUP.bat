@echo off
title Light Finance CCTV - Setup
color 0A

echo.
echo =====================================================
echo   Light Finance CCTV Monitoring Dashboard
echo   First-Time Setup
echo =====================================================
echo.

:: ─── Check Node.js ───────────────────────────────────
echo [Step 1/3] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js is not installed on this computer.
    echo.
    echo  Please download and install Node.js from:
    echo    https://nodejs.org  (choose the LTS version)
    echo.
    echo  After installing Node.js, run this SETUP.bat again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  Node.js found: %NODE_VER%
echo.

:: ─── Enable pnpm ─────────────────────────────────────
echo [Step 2/3] Setting up pnpm package manager...
corepack enable pnpm >nul 2>&1
if errorlevel 1 (
    echo  Installing pnpm via npm...
    npm install -g pnpm >nul 2>&1
)
for /f "tokens=*" %%i in ('pnpm --version 2^>nul') do set PNPM_VER=%%i
echo  pnpm ready: v%PNPM_VER%
echo.

:: ─── Install dependencies ─────────────────────────────
echo [Step 3/3] Installing dependencies (this may take a few minutes)...
echo  Please wait...
echo.
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
echo  Dependencies installed successfully.
echo.

:: ─── Build API server ────────────────────────────────
echo [Step 4/4] Building API server...
call pnpm --filter @workspace/api-server run build
if errorlevel 1 (
    echo.
    echo  ERROR: Failed to build the API server.
    echo.
    pause
    exit /b 1
)
echo.

:: ─── Done ─────────────────────────────────────────────
echo =====================================================
echo   Setup Complete!
echo =====================================================
echo.
echo  Database "Branch_CCTV" will be created automatically
echo  the first time you start the application.
echo.
echo  Next step: Double-click START.bat to launch the app.
echo.
pause
