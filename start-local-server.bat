@echo off
rem Server-like local run: exactly what a real user sees on the live site (login page, email confirmation, Home), per-user data,
rem strict SQL rules, using your real Supabase. Settings come from backend\.env.local-server (git-ignored).
rem Create or refresh that file with:  backend\.venv\Scripts\python.exe Scripts\make_local_server_env.py
cd /d "%~dp0"
if not exist "backend\.env.local-server" (
  echo backend\.env.local-server is missing. Create it with:
  echo    backend\.venv\Scripts\python.exe Scripts\make_local_server_env.py
  echo It is built from backend\.env.dokploy. Never paste those values anywhere else.
  pause
  exit /b 1
)
set DASHTOR_ENV_FILE=%~dp0backend\.env.local-server
set AUTH_ENABLED=true
set ALLOW_USER_PYTHON=false
call "%~dp0start-local.bat"
