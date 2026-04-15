@echo off
title Light Finance CCTV - Starting...

echo.
echo =====================================================
echo   Light Finance CCTV Monitoring Dashboard
echo =====================================================
echo.

if not exist "artifacts\api-server\dist\index.mjs" (
    echo  ERROR: App is not built yet. Please run SETUP.bat first!
    echo.
    pause
    exit /b 1
)

echo  Starting API Server on port 8080...
start "CCTV API Server" cmd /k "set PORT=8080 && set DATABASE_URL=postgresql://postgres:root@172.16.0.44:5432/Branch_CCTV && set NODE_ENV=production && node artifacts\api-server\dist\index.mjs"

echo  Waiting for API to start...
timeout /t 5 /nobreak >nul

echo  Starting Dashboard on port 3000...
start "CCTV Dashboard" cmd /k "set PORT=3000 && set BASE_PATH=/ && pnpm --filter @workspace/cctv-dashboard run dev"

echo  Waiting for Dashboard to start...
timeout /t 8 /nobreak >nul

echo  Opening browser...
start http://localhost:3000

echo.
echo =====================================================
echo   Application is Running!
echo =====================================================
echo.
echo   Dashboard  : http://localhost:3000
echo   API Server : http://localhost:8080
echo.
echo   Login : admin
echo   Pass  : admin@123
echo.
echo   To stop: close the two black CCTV command windows.
echo.
pause
