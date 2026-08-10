@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22 LTS first.
  pause
  exit /b 1
)

call npm run mindmap -- start
if errorlevel 1 (
  echo MindFlow failed to start.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:5173/"
echo MindFlow is running. You can close this window.
pause
