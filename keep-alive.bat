@echo off
rem =====================================================================
rem  NurseLearn PH keep-alive  (background watchdog)
rem
rem  Usage:
rem    keep-alive.bat            Start the watchdog in a hidden background
rem                              window. Safe to run twice - only one
rem                              instance is allowed.
rem    keep-alive.bat install    Also register the watchdog to start
rem                              automatically at every Windows logon.
rem    keep-alive.bat uninstall  Remove that automatic-start entry.
rem
rem  What it checks every ~45 seconds, see nurselearn-keep-alive.ps1:
rem    - local API on port 3003
rem    - the Cloudflare quick tunnel, whose free URL dies on every restart
rem    - the live Vercel site pointing at the CURRENT tunnel URL
rem    - the named tunnel for mapi.primeclc.com
rem    - the monitor-backend app
rem  It repairs everything automatically: restart, get new URL, repoint
rem  Vercel, verify.
rem
rem  Log file: keep-alive.log in this folder
rem =====================================================================

set "PS1=%~dp0nurselearn-keep-alive.ps1"
set "TASK=NurseLearn KeepAlive"

if /I "%~1"=="install" goto install
if /I "%~1"=="uninstall" goto uninstall

start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%PS1%"
echo Watchdog started in the background. Log: %~dp0keep-alive.log
exit /b 0

:install
schtasks /Create /F /TN "%TASK%" /TR "%~dp0keep-alive.bat" /SC ONLOGON /RL HIGHEST
if errorlevel 1 goto fail
schtasks /Run /TN "%TASK%"
echo OK: scheduled task "%TASK%" installed, starts at every logon, started now.
exit /b 0

:uninstall
schtasks /End /TN "%TASK%" 2>nul
schtasks /Delete /F /TN "%TASK%"
echo OK: scheduled task "%TASK%" removed.
exit /b 0

:fail
echo Failed to create the scheduled task. Run this file as Administrator.
exit /b 1
