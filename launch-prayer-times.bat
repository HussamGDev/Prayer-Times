@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
title Prayer Times Launcher

echo.
echo ==========================================
echo   Prayer Times One-Click Launcher
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :missing_node

where npm.cmd >nul 2>nul
if errorlevel 1 goto :missing_npm

if not exist "node_modules" (
  echo Installing project packages for first-time setup...
  call npm.cmd install
  if errorlevel 1 goto :install_failed
) else (
  echo Packages already installed.
)

echo Starting Prayer Times...
start "Prayer Times Dev Server" /min cmd /c "cd /d ""%~dp0"" && npm.cmd run dev"
start "" /min powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-when-ready.ps1"
goto :done

:missing_node
echo Node.js was not found on this computer.
echo Please install Node.js first, then run this file again.
echo Download: https://nodejs.org/
pause
exit /b 1

:missing_npm
echo npm.cmd was not found on this computer.
echo Please reinstall Node.js from the official installer, then run this file again.
pause
exit /b 1

:install_failed
echo Package installation failed.
echo Please review the terminal output above, then run this file again.
pause
exit /b 1

:done
exit /b 0
