@echo off
setlocal
title OriginTrace AI - Starting Services...

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo ==============================================================================
echo             OriginTrace AI - Digital Forensics Workbench Launcher
echo ==============================================================================
echo.

REM ------------------------------------------------------------------------------
REM 1. Verify Prerequisites (Python and Node.js)
REM ------------------------------------------------------------------------------
echo [1/5] Verifying system prerequisites...

REM Check Python virtualenv or system Python
set "PYTHON_EXE=%PROJECT_ROOT%venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    REM Try system python
    where python >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [ERROR] Python environment was not detected.
        echo Expected virtualenv at: %PROJECT_ROOT%venv\Scripts\python.exe
        echo Please ensure Python 3.10+ is installed and run: python -m venv venv
        echo.
        pause
        exit /b 1
    ) else (
        set "PYTHON_EXE=python"
    )
)
echo   - Python runtime: Found (%PYTHON_EXE%)

REM Check Node.js and npm
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js was not detected in PATH.
    echo Please install Node.js 18+ from https://nodejs.org/ to run the frontend.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do set "NODE_VER=%%V"
echo   - Node.js runtime: Found (%NODE_VER%)

where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] npm was not detected in PATH.
    echo.
    pause
    exit /b 1
)
echo   - npm package manager: Found

REM ------------------------------------------------------------------------------
REM 2. Check if Services are Already Running
REM ------------------------------------------------------------------------------
echo.
echo [2/5] Checking existing service port bindings...

powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%scripts\check_ports.ps1"
set "PORT_STATE=%ERRORLEVEL%"

if "%PORT_STATE%"=="10" (
    echo   - Both backend on port 8000 and frontend on port 5173 are already active.
    echo.
    echo [INFO] OriginTrace AI is already running!
    echo Opening browser to http://127.0.0.1:5173 ...
    start http://127.0.0.1:5173
    goto :ready_banner
)

if "%PORT_STATE%"=="1" (
    echo   - Backend on port 8000 is already active.
    set "START_BACKEND=0"
    set "START_FRONTEND=1"
) else if "%PORT_STATE%"=="2" (
    echo   - Frontend on port 5173 is already active.
    set "START_BACKEND=1"
    set "START_FRONTEND=0"
) else (
    echo   - Ports 8000 and 5173 are available.
    set "START_BACKEND=1"
    set "START_FRONTEND=1"
)

REM Ensure data folder exists
if not exist "data" mkdir "data"

REM ------------------------------------------------------------------------------
REM 3. Launch Backend if Not Running
REM ------------------------------------------------------------------------------
echo.
echo [3/5] Starting OriginTrace AI application processes...

if "%START_BACKEND%"=="1" (
    echo   - Starting FastAPI backend on http://127.0.0.1:8000 ...
    start "OriginTrace Backend" /min "%PYTHON_EXE%" -m uvicorn app.main:app --app-dir "%PROJECT_ROOT%backend" --host 127.0.0.1 --port 8000
) else (
    echo   - FastAPI backend is already running on port 8000.
)

REM ------------------------------------------------------------------------------
REM 4. Launch Frontend if Not Running
REM ------------------------------------------------------------------------------
if "%START_FRONTEND%"=="1" (
    echo   - Starting Vite frontend on http://127.0.0.1:5173 ...
    start "OriginTrace Frontend" /min cmd /c "cd /d "%PROJECT_ROOT%frontend" && npm run dev"
) else (
    echo   - Vite frontend is already running on port 5173.
)

REM ------------------------------------------------------------------------------
REM 5. Wait for Readiness & Poll Health Endpoints
REM ------------------------------------------------------------------------------
echo.
echo [4/5] Polling service health readiness (waiting for ports 8000 and 5173)...

powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%scripts\check_services.ps1"
if errorlevel 1 (
    echo.
    echo [WARNING] Services took longer than expected to report healthy.
    echo They may still be initializing. Checking URLs...
)

echo.
echo [5/5] Launching default browser to OriginTrace AI...
start http://127.0.0.1:5173

:ready_banner
echo.
echo ==============================================================================
echo              ORIGINTRACE AI IS ACTIVE AND READY TO USE!
echo ==============================================================================
echo.
echo   * Application UI   : http://127.0.0.1:5173
echo   * Backend REST API : http://127.0.0.1:8000
echo   * API Health Check : http://127.0.0.1:8000/api/health
echo   * Swagger Docs     : http://127.0.0.1:8000/docs
echo.
echo   To stop all running services cleanly at any time, execute:
echo     stop_origintrace.bat
echo   or run taskkill commands automatically.
echo ==============================================================================
echo.
echo Press any key to stop all OriginTrace AI services and close this window...
pause >nul

call "%PROJECT_ROOT%stop_origintrace.bat"
exit /b 0
