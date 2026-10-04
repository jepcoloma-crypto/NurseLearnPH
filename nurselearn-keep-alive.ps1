# NurseLearn PH keep-alive watchdog.
#
# Runs in the background (start it via keep-alive.bat) and checks every
# $CheckSeconds that the whole chain still works, repairing it automatically:
#
#   local API :3003        -> pm2 restart nurselearn-api
#   cloudflared quick tunnel-> pm2 restart nurselearn-tunnel (NEW random URL)
#   Vercel must point at the CURRENT tunnel URL -> update-tunnel-url.ps1
#   named tunnel (mapi.primeclc.com) process -> relaunch if dead
#   monitor-backend        -> pm2 restart if it stopped
#
# The free *.trycloudflare.com URL "expires" every time the tunnel process
# restarts (and Cloudflare makes no uptime promise for quick tunnels). This
# watchdog notices the dead URL, restarts the tunnel and repoints Vercel, so
# https://nurselearn-ph.vercel.app keeps working without manual steps.
#
# Throttling: at most one Vercel redeploy per $MinRotateGapMinutes and
# $MaxRotationsPerHour redeploy per hour, so a long outage cannot burn the
# Vercel Hobby deploy quota.
#
# Alerting: when two consecutive cycles end with problems, an email goes to
# SMTP_USER (the school mailbox, credentials in .env); it re-sends every 30
# minutes while broken and a RECOVERED mail when everything is healthy again.
# Test the mail path any time with:  -TestAlert
#
# Backup: the nightly database + storage backup (due daily after 01:30) is
# triggered from here when the marker in C:\NurseLearnPH-Backups is older
# than today, so it also catches up when the PC was off at 01:30. See
# backup-production.ps1.

param(
    [int]$CheckSeconds = 45,
    [int]$MinRotateGapMinutes = 5,
    [int]$MaxRotationsPerHour = 3,
    [switch]$TestAlert
)

$repo        = $PSScriptRoot
$logPath     = Join-Path $repo 'keep-alive.log'
$tunnelLog   = Join-Path $env:USERPROFILE '.pm2\logs\nurselearn-tunnel-error.log'
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$namedConfig = Join-Path $env:USERPROFILE '.cloudflared\config.yml'
$namedTunnel = 'e1d2299e-343b-4845-a279-8c977bef2569'
$namedArgs   = 'tunnel --config "' + $namedConfig + '" run ' + $namedTunnel
$siteUrl     = 'https://nurselearn-ph.vercel.app/'
$mapiUrl     = 'https://mapi.primeclc.com/api/auth/login'
$monRepo     = 'C:\Projects\Mutli-Account Balance & Transaction Monitoring System'
$backupMarker = 'C:\NurseLearnPH-Backups\last-run.txt'

# --- single instance -------------------------------------------------------
# (-TestAlert is a one-shot probe of the mail path and must be able to run
# while the real watchdog holds the mutex.)
if (-not $TestAlert) {
    $mutex = New-Object System.Threading.Mutex($false, 'Local\NurseLearnKeepAlive')
    if (-not $mutex.WaitOne(0)) { exit 0 }
}

function Log([string]$msg) {
    Add-Content -Path $logPath -Value ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) -Encoding utf8
}

# --- email alerting ----------------------------------------------------------
# Reads the same Gmail SMTP settings the API uses for signup mail (root .env)
# and sends the alert to SMTP_USER, so trouble is noticed without opening
# keep-alive.log.
function Get-DotEnv([string]$path) {
    $h = @{}
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
                $h[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
            }
        }
    }
    return $h
}

function Send-Alert([string]$subject, [string]$body) {
    try {
        $cfg  = Get-DotEnv (Join-Path $repo '.env')
        $sHost = $cfg['SMTP_HOST']
        $sUser = $cfg['SMTP_USER']
        $sPass = $cfg['SMTP_PASS']
        if (-not $sHost -or -not $sUser -or -not $sPass) {
            Log 'ALERT not sent: SMTP_HOST/SMTP_USER/SMTP_PASS missing from .env'
            return $false
        }
        $port = 587
        if ($cfg['SMTP_PORT'] -match '^\d+$') { $port = [int]$cfg['SMTP_PORT'] }
        $useSsl = ($port -eq 465 -or $port -eq 587)
        if ($cfg['SMTP_SECURE'] -eq 'true') { $useSsl = $true }
        $cred = New-Object System.Management.Automation.PSCredential(
            $sUser, (ConvertTo-SecureString $sPass -AsPlainText -Force))
        Send-MailMessage -SmtpServer $sHost -Port $port -UseSsl:$useSsl -Credential $cred `
            -From $sUser -To $sUser -Subject $subject -Body $body -ErrorAction Stop | Out-Null
        Log ('alert email sent: ' + $subject)
        return $true
    } catch {
        Log ('alert email FAILED: ' + $_.Exception.Message)
        return $false
    }
}

function Get-Pm2Status([string]$name) {
    $out = (pm2 list 2>$null | Out-String) -replace "\x1b\[[0-9;]*[A-Za-z]", ''
    $line = ($out -split "`r?`n") | Where-Object { $_ -like ('*' + $name + '*') } | Select-Object -First 1
    if (-not $line) { return 'missing' }
    if ($line -match 'online')  { return 'online' }
    if ($line -match 'errored') { return 'errored' }
    return 'stopped'
}

function Get-TunnelUrl() {
    if (-not (Test-Path $tunnelLog)) { return $null }
    $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
    if ($m -and $m.Matches.Count -gt 0) { return $m.Matches[0].Value }
    return $null
}

# kind: 'ok' (2xx/3xx), 'http' (origin answered 4xx/5xx that is not a
# Cloudflare edge error), 'cf-dead' (Cloudflare could not reach the origin),
# 'conn-fail' (no HTTP response at all).
function Get-HttpState([string]$uri, [int]$timeout = 12) {
    try {
        $r = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec $timeout
        return @{ kind = 'ok'; code = [int]$r.StatusCode }
    } catch {
        $code = 0
        if ($_.Exception.Response) {
            try { $code = [int]$_.Exception.Response.StatusCode } catch { $code = 0 }
        }
        if ($code -in 502,520,521,522,523,526,530) { return @{ kind = 'cf-dead'; code = $code } }
        if ($code -gt 0) { return @{ kind = 'http'; code = $code } }
        return @{ kind = 'conn-fail'; code = 0 }
    }
}

function Invoke-Pm2Start([string]$only) {
    Push-Location $repo
    pm2 start ecosystem.config.js --only $only 2>&1 | Out-Null
    Pop-Location
}

function Invoke-Pm2Restart([string]$name) {
    Push-Location $repo
    pm2 restart $name 2>&1 | Out-Null
    Pop-Location
}

function Start-NamedTunnel {
    Start-Process -FilePath $cloudflared -ArgumentList $namedArgs -WindowStyle Hidden
}

$lastRotate        = [datetime]::MinValue
$rotateTimestamps  = @()
$rotateOutcome     = 'ok'   # 'ok' | 'deferred' | 'failed' (result of last Invoke-Rotate)

function Invoke-Rotate {
    if (((Get-Date) - $lastRotate).TotalMinutes -lt $MinRotateGapMinutes) {
        Log 'rotate requested but cooldown is active - deferred'
        $script:rotateOutcome = 'deferred'
        return $false
    }
    $script:rotateTimestamps = @($rotateTimestamps | Where-Object { ((Get-Date) - $_).TotalHours -lt 1 })
    if ($rotateTimestamps.Count -ge $MaxRotationsPerHour) {
        Log ('rotate requested but hourly limit (' + $MaxRotationsPerHour + ') reached - deferred')
        $script:rotateOutcome = 'deferred'
        return $false
    }
    Log 'rotating Vercel to the current tunnel URL (update-tunnel-url.ps1)...'
    $out  = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'update-tunnel-url.ps1') 2>&1 | Out-String)
    $code = $LASTEXITCODE
    $script:lastRotate = Get-Date
    $script:rotateTimestamps += , (Get-Date)
    if ($code -eq 0) { Log 'rotate OK'; $script:rotateOutcome = 'ok'; return $true }
    $tail = (($out -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -Last 3) -join ' | '
    Log ('rotate FAILED exit=' + $code + ' tail: ' + $tail)
    $script:rotateOutcome = 'failed'
    return $false
}

# --- one-shot test alert (-TestAlert) ----------------------------------------
if ($TestAlert) {
    Log 'sending test alert (-TestAlert)...'
    $ok = Send-Alert ('NurseLearn watchdog TEST alert (' + $env:COMPUTERNAME + ')') (
        'This is a test email from nurselearn-keep-alive.ps1 - alerting works.' +
        "`r`n`r`nTime: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
    if ($ok) { exit 0 }
    exit 1
}

# --- main loop ---------------------------------------------------------------
Log ('watchdog started (check every ' + $CheckSeconds + 's, repo ' + $repo + ')')
$cycle          = 0
$tunnelFail     = 0
$apiFail        = 0
$siteFail       = 0
$badCycles      = 0
$alertActive    = $false
$alertLast      = [datetime]::MinValue
$alertAt        = [datetime]::MinValue

while ($true) {
    $cycle++
    $extraSleep = 0
    try {
        $rotateOutcome = 'ok'
        $mapiDead      = $false
        # ---- pm2 apps present and online ----
        $apiSt = Get-Pm2Status 'nurselearn-api'
        $tunSt = Get-Pm2Status 'nurselearn-tunnel'
        $monSt = Get-Pm2Status 'monitor-backend'
        if ($apiSt -ne 'online') {
            $action = 'restarting'; if ($apiSt -eq 'missing') { $action = 'starting via ecosystem' }
            Log ("nurselearn-api is '" + $apiSt + "' - " + $action)
            if ($apiSt -eq 'missing') { Invoke-Pm2Start 'nurselearn-api' } else { Invoke-Pm2Restart 'nurselearn-api' }
            Start-Sleep 4
        }
        if ($tunSt -ne 'online') {
            $action = 'restarting'; if ($tunSt -eq 'missing') { $action = 'starting via ecosystem' }
            Log ("nurselearn-tunnel is '" + $tunSt + "' - " + $action + ' (URL will change)')
            if ($tunSt -eq 'missing') { Invoke-Pm2Start 'nurselearn-tunnel' } else { Invoke-Pm2Restart 'nurselearn-tunnel' }
            Start-Sleep 10; $extraSleep = 60
        }

        # ---- local API :3003 ----
        $a = Get-HttpState 'http://localhost:3003/api/health' 8
        if ($a.kind -eq 'ok') { $apiFail = 0 }
        else {
            $apiFail++
            if ($apiFail -ge 2) {
                Log ('local API unhealthy (' + $a.kind + ') - restarting nurselearn-api')
                Invoke-Pm2Restart 'nurselearn-api'; $apiFail = 0; Start-Sleep 6
            }
        }

        # ---- tunnel URL alive? (2 consecutive failures before acting) ----
        $url = Get-TunnelUrl
        $alive = $false
        if ($url) {
            $t = Get-HttpState ($url + '/api/health') 12
            $alive = ($t.kind -eq 'ok')
        }
        if ($alive) { $tunnelFail = 0 }
        else {
            $tunnelFail++
            if ($tunnelFail -ge 2) {
                Log ('tunnel dead (url=' + $url + ') - restarting nurselearn-tunnel (URL will change)')
                if ((Get-Pm2Status 'nurselearn-tunnel') -eq 'missing') { Invoke-Pm2Start 'nurselearn-tunnel' } else { Invoke-Pm2Restart 'nurselearn-tunnel' }
                $tunnelFail = 0
                Start-Sleep 12; $extraSleep = 60
            }
        }

        # ---- does Vercel still point at the current tunnel URL? ----
        $needsRotate = $false
        $current = Get-TunnelUrl
        if (-not $current) {
            Log 'no tunnel URL found in pm2 log yet'
        } else {
            $dest = ''
            try {
                $vjObj = Get-Content (Join-Path $repo 'client\vercel.json') -Raw | ConvertFrom-Json
                $dest = ($vjObj.rewrites | Where-Object { $_.source -eq '/storage/:path*' } |
                         ForEach-Object { $_.destination }) -join ''
            } catch { $dest = '' }
            $vhost = ([uri]$current).Host
            if ($dest -notlike ('*' + $vhost + '*')) {
                Log 'client/vercel.json points at a different tunnel - rotate needed'
                $needsRotate = $true
            }
        }

        # ---- deep check: live site bundle actually embeds current URL ----
        if (($cycle % 5) -eq 0 -and $current) {
            $siteOk = $false
            try {
                $homePage = (Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 15).Content
                $asset = [regex]::Match($homePage, 'assets/index-[^"]+\.js').Value
                if ($asset) {
                    $js = (Invoke-WebRequest -Uri ($siteUrl + $asset) -UseBasicParsing -TimeoutSec 25).Content
                    if ($js.Contains(([uri]$current).Host)) { $siteOk = $true }
                }
            } catch { $siteOk = $false }
            if ($siteOk) { $siteFail = 0 }
            else {
                $siteFail++
                if ($siteFail -ge 2) {
                    Log 'live site does not embed the current tunnel URL - rotate needed'
                    $needsRotate = $true; $siteFail = 0
                }
            }
        }

        if ($needsRotate) { Invoke-Rotate | Out-Null }

        # ---- named tunnel for mapi.primeclc.com (stable, no redeploy) ----
        $named = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
                 Where-Object { $_.CommandLine -like ('*' + $namedTunnel + '*') }
        if (-not $named) {
            Log 'named tunnel process missing - relaunching (mapi.primeclc.com)'
            Start-NamedTunnel; Start-Sleep 6
            $mapiDead = $true
        } else {
            $m = Get-HttpState $mapiUrl 12
            if ($m.kind -in @('cf-dead', 'conn-fail')) {
                Log ('mapi.primeclc.com unreachable (' + $m.kind + ') - recycling named tunnel')
                $named | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
                Start-Sleep 2; Start-NamedTunnel; Start-Sleep 6
                $mapiDead = $true
            }
        }

        # ---- monitor-backend ----
        if ($monSt -ne 'online') {
            if ($monSt -eq 'missing') {
                Log 'monitor-backend is missing from pm2 - starting via ecosystem'
                Push-Location $monRepo
                pm2 start ecosystem.config.js --only monitor-backend 2>&1 | Out-Null
                Pop-Location
            } else {
                Log ("monitor-backend is '" + $monSt + "' - restarting")
                pm2 restart monitor-backend 2>&1 | Out-Null
            }
            Start-Sleep 5
        }

        # ---- nightly backup: due once per day after 01:30 local ----
        $bMarker = Get-Content $backupMarker -Raw -ErrorAction SilentlyContinue
        if ((Get-Date) -ge (Get-Date -Hour 1 -Minute 30 -Second 0) -and
            (-not $bMarker -or ($bMarker -split '\s+')[0] -ne (Get-Date -Format 'yyyy-MM-dd'))) {
            Log 'nightly backup due - running backup-production.ps1...'
            $bOut  = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'backup-production.ps1') 2>&1 | Out-String)
            $bCode = $LASTEXITCODE
            if ($bCode -eq 0) {
                Log 'nightly backup OK'
            } else {
                $bTail = (($bOut -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -Last 2) -join ' | '
                Log ('nightly backup FAILED exit=' + $bCode + ' tail: ' + $bTail)
                # guarantee a FAIL marker even on a hard crash, so we retry tomorrow
                if (-not ((Get-Content $backupMarker -Raw -ErrorAction SilentlyContinue) -like ((Get-Date -Format 'yyyy-MM-dd') + '*'))) {
                    Set-Content -Path $backupMarker -Value ((Get-Date -Format 'yyyy-MM-dd') + ' FAIL') -Encoding ASCII
                }
            }
            $bMarker = Get-Content $backupMarker -Raw -ErrorAction SilentlyContinue
        }

        # ---- end-of-cycle health summary -> alert emails ----
        # Alert after 2 consecutive bad cycles, re-send every 30 minutes
        # while broken, and mail a RECOVERED note when all-clear again.
        $issues = @()
        if ($bMarker -and $bMarker.Trim() -eq ((Get-Date -Format 'yyyy-MM-dd') + ' FAIL')) { $issues += 'nightly backup failed' }
        $lastUrl = Get-TunnelUrl
        $tunOk = $false
        if ($lastUrl) { $tunOk = ((Get-HttpState ($lastUrl + '/api/health') 10).kind -eq 'ok') }
        if (-not $tunOk)      { $issues += 'tunnel unreachable' }
        if ($a.kind -ne 'ok') { $issues += 'local API unreachable' }
        if ($mapiDead)        { $issues += 'mapi.primeclc.com unreachable' }
        if ($rotateOutcome -in @('deferred', 'failed')) { $issues += 'Vercel rotation ' + $rotateOutcome }

        if ($issues.Count -eq 0) {
            if ($alertActive) {
                Send-Alert ('RECOVERED - NurseLearn watchdog (' + $env:COMPUTERNAME + ')') (
                    'All monitored services are healthy again.' +
                    "`r`n`r`nWas failing since: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss' -Date $alertAt) +
                    "`r`n`r`nLast log lines:`r`n" +
                    ((Get-Content $logPath -Tail 15) -join "`r`n")) | Out-Null
                $alertActive = $false
                Log 'recovery notification sent'
            }
            $badCycles = 0
        } else {
            $badCycles++
            if ($badCycles -ge 2 -and (-not $alertActive -or ((Get-Date) - $alertLast).TotalMinutes -ge 30)) {
                $prefix = 'still failing'
                if (-not $alertActive) { $prefix = 'recovery failing'; $alertAt = Get-Date }
                Send-Alert ('NurseLearn watchdog: ' + $prefix + ' - ' + ($issues -join '; ') +
                            ' (' + $env:COMPUTERNAME + ')') (
                    'Detected at: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') +
                    "`r`nCycle: $cycle" + "`r`nIssues: " + ($issues -join '; ') +
                    "`r`n`r`nLast log lines:`r`n" +
                    ((Get-Content $logPath -Tail 15) -join "`r`n")) | Out-Null
                $alertActive = $true
                $alertLast   = Get-Date
            }
        }

        # ---- heartbeat every 10 cycles (~7-8 min) ----
        if (($cycle % 10) -eq 0) {
            Log ('heartbeat cycle=' + $cycle + ' api=' + $apiSt + ' tunnel=' + $tunSt + ' mon=' + $monSt + ' url=' + $current)
        }
    } catch {
        Log ('cycle error: ' + $_.Exception.Message)
    }
    Start-Sleep -Seconds ($CheckSeconds + $extraSleep)
}
