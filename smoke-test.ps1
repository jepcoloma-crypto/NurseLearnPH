# Smoke test for the live NurseLearn PH stack: frontend, API tunnel, auth, DB.
# Run after every deploy or whenever the public URLs change:
#
#   powershell -ExecutionPolicy Bypass -File .\smoke-test.ps1
#
# Exits 0 when every check passes, 1 otherwise (CI/schedule friendly).
# When -ApiUrl is omitted the current quick-tunnel URL is read from the pm2
# log, exactly like update-tunnel-url.ps1 does.
#
# The default credentials are the documented seed accounts (DEPLOY.md - 8).
param(
  [string]$Frontend = 'https://nurselearn-ph.vercel.app',
  [string]$ApiUrl = '',
  [string]$User = 'admin',
  [string]$Password = 'admin123'
)
$ErrorActionPreference = 'Stop'
$script:results = @()
$script:token = ''

function Check([string]$name, [scriptblock]$test) {
  try {
    $detail = & $test
    $script:results += [pscustomobject]@{ Name = $name; Ok = $true }
    Write-Host ("  PASS  {0} - {1}" -f $name, $detail) -ForegroundColor Green
  } catch {
    $script:results += [pscustomobject]@{ Name = $name; Ok = $false }
    Write-Host ("  FAIL  {0} - {1}" -f $name, $_.Exception.Message) -ForegroundColor Red
  }
}

Write-Host ("NurseLearn PH smoke test - {0}" -f (Get-Date -Format s))
Write-Host ""

# Resolve the API base URL (quick tunnels get a new URL on every restart)
if (-not $ApiUrl) {
  $log = Join-Path $env:USERPROFILE '.pm2\logs\nurselearn-tunnel-error.log'
  $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
  if ($m) { $ApiUrl = $m.Matches[0].Value }
}
if ($ApiUrl) { Write-Host "API: $ApiUrl" } else { Write-Host "API: (not resolved)" }
Write-Host "Frontend: $Frontend"
Write-Host ""

Check 'Frontend serves the SPA' {
  $r = Invoke-WebRequest $Frontend -UseBasicParsing -TimeoutSec 30
  if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
  if ($r.Content -notmatch 'id="root"') { throw 'SPA shell (id=root) missing' }
  'HTTP 200 with app shell'
}

Check 'API health through the tunnel' {
  if (-not $ApiUrl) { throw 'no API URL - pass -ApiUrl or start nurselearn-tunnel (pm2 logs nurselearn-tunnel)' }
  $h = Invoke-RestMethod "$ApiUrl/api/health" -TimeoutSec 30
  if ($h.status -ne 'ok') { throw "status=$($h.status)" }
  "status=ok, env=$($h.environment)"
}

Check 'Login issues a token' {
  if (-not $ApiUrl) { throw 'no API URL' }
  $body = @{ username = $User; password = $Password } | ConvertTo-Json
  $r = Invoke-RestMethod "$ApiUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 30
  if (-not $r.success) { throw 'success flag false' }
  if (-not $r.data.accessToken) { throw 'no accessToken in response' }
  $script:token = $r.data.accessToken
  "user=$($r.data.user.username) role=$($r.data.user.role)"
}

Check 'Authenticated reads work' {
  if (-not $script:token) { throw 'no token - login check did not run' }
  $h = @{ Authorization = "Bearer $script:token" }
  $me = Invoke-RestMethod "$ApiUrl/api/auth/me" -Headers $h -TimeoutSec 30
  if (-not $me.success) { throw 'auth/me success flag false' }
  $courses = Invoke-RestMethod "$ApiUrl/api/academic/courses?page=1&limit=1" -Headers $h -TimeoutSec 30
  if ($null -eq $courses.data.pagination.total) { throw 'courses pagination missing' }
  "me=$($me.data.username), courses total=$($courses.data.pagination.total)"
}

$failed = @($script:results | Where-Object { -not $_.Ok })
Write-Host ""
if ($failed.Count -eq 0) {
  Write-Host ("All {0} checks passed." -f $script:results.Count) -ForegroundColor Green
  exit 0
}
Write-Host ("{0} of {1} checks FAILED: {2}" -f $failed.Count, $script:results.Count, (($failed | ForEach-Object { $_.Name }) -join ', ')) -ForegroundColor Red
exit 1
