@echo off
rem Server-like local run: login ON with your real Supabase, per-user data, strict SQL rules - exactly the server's behaviour.
rem Needs backend\.env (git-ignored) with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET (see backend\.env.example).
cd /d "%~dp0"
findstr /b /c:"SUPABASE_JWT_SECRET=" "backend\.env" >nul 2>&1
if errorlevel 1 (
  echo backend\.env is missing or has no SUPABASE_JWT_SECRET. Copy backend\.env.example to backend\.env and fill in your Supabase values.
  echo Never paste those values anywhere else.
  pause
  exit /b 1
)
set AUTH_ENABLED=true
set ALLOW_USER_PYTHON=false
call "%~dp0start-local.bat"
