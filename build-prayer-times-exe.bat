@echo off
setlocal
cd /d "%~dp0"

echo Building Prayer Times desktop package...
call npm.cmd install
if errorlevel 1 (
  echo Failed to install dependencies.
  exit /b 1
)

call npm.cmd run build:exe
if errorlevel 1 (
  echo Failed to build desktop package.
  exit /b 1
)

echo.
echo Done.
echo Check the "release" folder for:
echo - installer .exe
echo - win-unpacked app folder
pause
