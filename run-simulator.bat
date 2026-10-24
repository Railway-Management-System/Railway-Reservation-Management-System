@echo off
REM ==============================================================================
REM Railway Reservation Management System - Daily Operations Simulator Batch Runner
REM Executes the daily rolling window simulator (today to today+6) in non-interactive mode.
REM Suitable for Windows Task Scheduler or manual cron-style invocation.
REM ==============================================================================

setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ==============================================================================
echo  Railway Operations Daily Simulator Runner
echo ==============================================================================
echo [Simulator Runner] Root directory: %CD%
echo [Simulator Runner] Invoking node backend\scripts\simulate-daily.js %*
echo.

node backend\scripts\simulate-daily.js %*
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% NEQ 0 (
    echo.
    echo [Simulator Runner ERROR] Simulation failed with exit code %EXIT_CODE%.
    exit /b %EXIT_CODE%
)

echo.
echo [Simulator Runner SUCCESS] Simulation completed successfully.
exit /b 0
