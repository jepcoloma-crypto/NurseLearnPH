# Rotates the Cloudflare quick-tunnel URL into the live Vercel deployment.
#
# Quick tunnels get a NEW random URL every time they restart, so after ANY
# tunnel restart run:
#
#   powershell -ExecutionPolicy Bypass -File .\update-tunnel-url.ps1
#
# It reads the newest URL from the pm2 tunnel log, rewrites the /storage
# proxy in client/vercel.json, swaps the Vite build env var, and redeploys.
$ErrorActionPreference = 'Stop'

$repo = $PSScriptRoot
$log = Join-Path $env:USERPROFILE '.pm2\logs\nurselearn-tunnel-error.log'

$url = (Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' |
  Select-Object -Last 1).Matches[0].Value
if (-not $url) { throw "No tunnel URL found in $log — is nurselearn-tunnel running? (pm2 logs nurselearn-tunnel)" }
Write-Host "Tunnel URL: $url"

# Sanity: the tunnel must actually serve before we publish it
$health = Invoke-RestMethod "$url/api/health" -TimeoutSec 20
if ($health.status -ne 'ok') { throw "Tunnel health check failed: $($health | ConvertTo-Json -Compress)" }
Write-Host "Tunnel health: ok"

# 1. Point the /storage rewrite at the new URL
$vjPath = Join-Path $repo 'client\vercel.json'
$vj = Get-Content $vjPath -Raw | ConvertFrom-Json
$vj.rewrites | Where-Object { $_.source -eq '/storage/:path*' } |
  ForEach-Object { $_.destination = "$url/storage/:path*" }
$vj | ConvertTo-Json -Depth 10 | Set-Content $vjPath -Encoding utf8
Write-Host "client/vercel.json updated"

# 2. Swap the build-time API URL and redeploy production
Push-Location (Join-Path $repo 'client')
try {
  vercel env rm VITE_API_URL production --yes | Out-Null
  $url | vercel env add VITE_API_URL production | Out-Null
  vercel deploy --prod
}
finally { Pop-Location }

Write-Host ""
Write-Host "Done — https://nurselearn-ph.vercel.app now talks to $url" -ForegroundColor Green
