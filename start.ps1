# 검수 웹(3060) — 빌드 후 실행
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "web")
if (-not (Test-Path node_modules)) { npm install }
npm run build
Start-Process -FilePath "npm.cmd" -ArgumentList "start" -WindowStyle Minimized
Write-Host "검수 웹: http://localhost:3060"
