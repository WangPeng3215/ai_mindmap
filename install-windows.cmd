@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22 LTS first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

call npm install
if errorlevel 1 goto :failed

call npm test
if errorlevel 1 goto :failed

call npm run build
if errorlevel 1 goto :failed

echo.
echo MindFlow installation completed.
echo Run start-mindflow.cmd to start the application.
pause
exit /b 0

:failed
echo.
echo MindFlow installation failed. Review the error above.
pause
exit /b 1
