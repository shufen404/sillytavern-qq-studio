@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\node.exe" set "PATH=%~dp0runtime;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 20+ including npm from https://nodejs.org/
  pause
  exit /b 1
)
node studio-launcher.mjs %*
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
