@echo off
setlocal
cd /d "%~dp0"
echo === Dashtor: update from GitHub, install, and start (local mode) ===

git fetch origin Dashtor_First || goto :fail

rem Never overwrite your work: stop if tracked files have uncommitted changes.
set DIRTY=
for /f %%i in ('git status --porcelain --untracked-files=no') do set DIRTY=1
if defined DIRTY (
  echo.
  echo You have uncommitted changes in tracked files:
  git status --short --untracked-files=no
  echo Commit or stash them, then run this again.
  pause
  exit /b 1
)

git checkout Dashtor_First || goto :fail
git pull --ff-only origin Dashtor_First || goto :fail

if not exist "backend\.venv\Scripts\python.exe" (
  echo Creating backend\.venv ...
  python -m venv "backend\.venv" || goto :fail
)
"backend\.venv\Scripts\python.exe" -m pip install -q -r "backend\requirements.txt" || goto :fail

pushd frontend
call npm install --no-audit --no-fund || goto :fail
popd

start "Dashtor backend" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe main.py"
start "Dashtor frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo.
echo Started. Open http://localhost:5174 (first start may take a few seconds).
exit /b 0

:fail
echo.
echo Something failed above. Copy the message and send it to me.
pause
exit /b 1
