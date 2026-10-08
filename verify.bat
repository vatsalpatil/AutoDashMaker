@echo off
setlocal
cd /d "%~dp0"
if not exist "backend\.venv\Scripts\python.exe" (
  echo backend\.venv is missing. Run start-local.bat once first - it creates it and installs everything.
  pause
  exit /b 1
)
"backend\.venv\Scripts\python.exe" scripts\verify.py %*
echo.
pause
