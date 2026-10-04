@echo off
rem Register the NIGHTLY BACKUP (01:30) as a Windows scheduled task, so it
rem runs even if the keep-alive watchdog is not running. Optional extra
rem safety - the watchdog also runs the backup itself when due.
rem
rem Both runners share C:\NurseLearnPH-Backups\last-run.txt, so a day is
rem never backed up twice.
rem
rem Run this ONCE from an ELEVATED prompt (right-click -> Run as
rem administrator). Verify later with:  schtasks /Query /TN "NurseLearn PH Backup"

schtasks /Create /F /TN "NurseLearn PH Backup" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\Projects\NurseLearnPH\backup-production.ps1" /SC DAILY /ST 01:30
if errorlevel 1 (
  echo Failed - run this file as Administrator, then try again.
  exit /b 1
)
echo OK: scheduled task "NurseLearn PH Backup" runs daily at 01:30.
exit /b 0
