@echo off
title Light Finance CCTV - Starting...
color 0A

echo.
echo =====================================================
echo   Light Finance CCTV Monitoring Dashboard
echo   Starting Application...
echo =====================================================
echo.

:: ─── Check setup was done ─────────────────────────────
if not exist "artifacts\api-server\dist\index.mjs" (
    echo  ERROR: App not built yet. Please run SETUP.bat first!
    echo.
    pause
    exit /b 1
)

:: ─── Database & App Configuration ─────────────────────
set DB_HOST=172.16.0.44
set DB_PORT=5432
set DB_USER=postgres
set DB_PASSWORD=root
set DB_NAME=Branch_CCTV
set DATABASE_URL=postgresql://%DB_USER%:%DB_PASSWORD%@%DB_HOST%:%DB_PORT%/%DB_NAME%

set API_PORT=8080
set FRONTEND_PORT=3000

:: ─── Start API Server ──────────────────────────────────
echo  Starting API Server on port %API_PORT%...
start "CCTV - API Server" cmd /k "title CCTV API Server && set PORT=%API_PORT% && set DATABASE_URL=%DATABASE_URL% && set NODE_ENV=production && node artifacts\api-server\dist\index.mjs"

:: ─── Wait for API to initialise ───────────────────────
echo  Waiting for API server to start...
timeout /t 5 /nobreak >nul

:: ─── Start Frontend ───────────────────────────────────
echo  Starting Dashboard on port %FRONTEND_PORT%...
start "CCTV - Dashboard" cmd /k "title CCTV Dashboard && set PORT=%FRONTEND_PORT% && set BASE_PATH=/ && pnpm --filter @workspace/cctv-dashboard run dev"

:: ─── Wait for frontend to start ───────────────────────
echo  Waiting for Dashboard to start...
timeout /t 8 /nobreak >nul

:: ─── Open Browser ─────────────────────────────────────
echo  Opening browser...
start http://localhost:%FRONTEND_PORT%

:: ─── Done ─────────────────────────────────────────────
echo.
echo =====================================================
echo   Application is Running!
echo =====================================================
echo.
echo   Dashboard:  http://localhost:%FRONTEND_PORT%
echo   API Server: http://localhost:%API_PORT%
echo.
echo   Login:  admin
echo   Pass :  admin@123
echo.
echo   To stop: close the two black "CCTV" command windows.
echo.
pause
