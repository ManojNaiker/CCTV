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
    echo    https://nodejs.org   (choose the LTS version)
    echo.
    echo  After installing Node.js, run SETUP.bat again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  Node.js found: %NODE_VER%
echo.

echo [2/4] Setting up pnpm...
call corepack enable pnpm >nul 2>&1
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo  Installing pnpm via npm...
    call npm install -g pnpm
    if errorlevel 1 (
        echo  ERROR: Could not install pnpm.
        pause
        exit /b 1
    )
)
echo  pnpm ready.
echo.

echo [3/4] Installing dependencies (may take a few minutes)...
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

echo Creating START.bat...
(
    echo @echo off
    echo title Light Finance CCTV - Starting...
    echo.
    echo echo.
    echo echo =====================================================
    echo echo   Light Finance CCTV Monitoring Dashboard
    echo echo =====================================================
    echo echo.
    echo if not exist "artifacts\api-server\dist\index.mjs" (
    echo     echo  ERROR: App not built. Please run SETUP.bat first.
    echo     pause
    echo     exit /b 1
    echo ^)
    echo echo  Starting API Server...
    echo start "CCTV API Server" cmd /k "set PORT=8080 && set DATABASE_URL=postgresql://postgres:root@172.16.0.44:5432/Branch_CCTV && set NODE_ENV=production && node artifacts\api-server\dist\index.mjs"
    echo timeout /t 5 /nobreak ^>nul
    echo echo  Starting Dashboard...
    echo start "CCTV Dashboard" cmd /k "set PORT=3000 && set BASE_PATH=/ && pnpm --filter @workspace/cctv-dashboard run dev"
    echo timeout /t 8 /nobreak ^>nul
    echo echo  Opening browser...
    echo start http://localhost:3000
    echo echo.
    echo echo =====================================================
    echo echo   Application is Running!
    echo echo =====================================================
    echo echo.
    echo echo   Dashboard  : http://localhost:3000
    echo echo   API Server : http://localhost:8080
    echo echo.
    echo echo   Login : admin
    echo echo   Pass  : admin@123
    echo echo.
    echo echo   To stop: close the two black CCTV command windows.
    echo echo.
    echo pause
) > START.bat
echo  START.bat created successfully.
echo.

echo =====================================================
echo   Setup Complete!
echo =====================================================
echo.
echo  Branch_CCTV database will be created automatically
echo  on first launch.
echo.
echo  Next step: Double-click START.bat to launch the app.
echo.
pause
