# NurseLearn PH nightly backup.
#
# Dumps the PRODUCTION database (DATABASE_URL from .env.production, custom
# compressed format), zips the storage/ uploads, and deletes backups older
# than $KeepDays. Everything lands in $BackupRoot with a backup.log trail.
#
# Runners (both share last-run.txt, so a day is never backed up twice):
#   - the watchdog nurselearn-keep-alive.ps1, daily after 01:30 local, with
#     catch-up if the PC was off at 01:30 (fails -> alert email +1 cycle)
#   - optionally the scheduled task "NurseLearn PH Backup" (01:30), see
#     install-backup.bat (run once as Administrator)
#
# Manual run:
#   powershell -ExecutionPolicy Bypass -File .\backup-production.ps1
#
# Restore a dump with:
#   pg_restore --clean --if-exists --dbname=<connection-string> <file.dump>

param(
    [string]$BackupRoot = 'C:\NurseLearnPH-Backups',
    [int]$KeepDays = 14
)

$repo       = $PSScriptRoot
$envFile    = Join-Path $repo '.env.production'
$logPath    = Join-Path $BackupRoot 'backup.log'
$markerPath = Join-Path $BackupRoot 'last-run.txt'

function Log([string]$msg) {
    if (-not (Test-Path $BackupRoot)) { New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null }
    Add-Content -Path $logPath -Value ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) -Encoding utf8
    # keep the log bounded
    if ((Test-Path $logPath) -and (Get-Item $logPath).Length -gt 512KB) {
        $keep = Get-Content $logPath -Tail 400
        Set-Content -Path $logPath -Value $keep -Encoding utf8
    }
}

# "yyyy-MM-dd OK|FAIL" - written on EVERY exit path so the watchdog sees
# that today is done (and raises an alert on FAIL) instead of retrying.
function Set-Marker([string]$status) {
    if (-not (Test-Path $BackupRoot)) { New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null }
    Set-Content -Path $markerPath -Value ((Get-Date -Format 'yyyy-MM-dd') + ' ' + $status) -Encoding ASCII
}

# --- connection string (production only) -------------------------------------
$dbUrl = ''
try {
    $line = Get-Content $envFile -ErrorAction Stop | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
    if ($line) { $dbUrl = ($line -replace '^DATABASE_URL=', '') -replace '^"|"$', '' }
} catch { $dbUrl = '' }
if (-not $dbUrl) { Log 'FAILED: DATABASE_URL not found in .env.production'; Set-Marker 'FAIL'; exit 1 }
if ($dbUrl -notmatch 'nurselearn_ph_prod') {
    Log ('FAILED: refusing to back up a database that is not nurselearn_ph_prod (got: ' +
         (($dbUrl -split '/')[-1] -split '\?')[0] + ')')
    Set-Marker 'FAIL'
    exit 1
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Log 'FAILED: pg_dump not found on PATH'
    Set-Marker 'FAIL'
    exit 1
}

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

# --- database dump ------------------------------------------------------------
$dumpPath = Join-Path $BackupRoot ('nurselearn_ph_prod-{0}.dump' -f $stamp)
$err = & pg_dump --dbname="$dbUrl" -Fc -f $dumpPath 2>&1
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dumpPath)) {
    Log ('FAILED: pg_dump exit=' + $LASTEXITCODE + ' ' + (($err | Select-Object -Last 3) -join ' | '))
    Set-Marker 'FAIL'
    exit 1
}
$dumpMb = [math]::Round((Get-Item $dumpPath).Length / 1MB, 2)
if ($dumpMb -le 0) { Log 'FAILED: dump file is empty'; Set-Marker 'FAIL'; exit 1 }

# --- storage uploads ----------------------------------------------------------
$storageSrc = Join-Path $repo 'storage'
$zipMb = 'n/a'
if (Test-Path $storageSrc) {
    $zipPath = Join-Path $BackupRoot ('storage-{0}.zip' -f $stamp)
    try {
        Compress-Archive -Path (Join-Path $storageSrc '*') -DestinationPath $zipPath -Force -ErrorAction Stop
        $zipMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    } catch {
        $zipMb = 'error: ' + $_.Exception.Message
    }
}

# --- retention ----------------------------------------------------------------
$cutoff  = (Get-Date).AddDays(-$KeepDays)
$oldBackups = Get-ChildItem $BackupRoot -File | Where-Object {
    $_.Name -notin @('backup.log', 'last-run.txt') -and $_.LastWriteTime -lt $cutoff
}
$removed = 0
foreach ($f in $oldBackups) { Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue; $removed++ }

Log ('OK: db_dump=' + $dumpMb + 'MB storage_zip=' + $zipMb + 'MB kept_days=' + $KeepDays + ' purged=' + $removed)
Set-Marker 'OK'
exit 0
