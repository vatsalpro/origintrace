@echo off
setlocal
title OriginTrace AI - Shutdown

echo ==============================================================================
echo   OriginTrace AI - Stopping Application Services
echo ==============================================================================
echo.

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%scripts\stop_services.ps1"

echo.
echo ==============================================================================
echo   OriginTrace AI shutdown complete.
echo ==============================================================================
echo.
ping 127.0.0.1 -n 3 >nul
