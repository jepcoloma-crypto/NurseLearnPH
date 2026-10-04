@echo off
rem Nightly backup for NurseLearn PH (database + storage uploads).
rem Started daily at 01:30 by the scheduled task "NurseLearn PH Backup",
rem or run manually. Logic lives in backup-production.ps1; see DEPLOY.md
rem for restore instructions. Backups: C:\NurseLearnPH-Backups (14 days).
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0backup-production.ps1"
