$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22.5 or newer is required."
}
if (-not (Get-Command pnpm.cmd -ErrorAction SilentlyContinue)) {
  throw "pnpm is required. Install it with Corepack or npm."
}

pnpm.cmd migrate

Start-Process -WindowStyle Hidden -FilePath "pnpm.cmd" -ArgumentList "start:server" -WorkingDirectory $projectRoot | Out-Null
Start-Process -WindowStyle Hidden -FilePath "pnpm.cmd" -ArgumentList "dev -- --host 127.0.0.1 --port 5173" -WorkingDirectory $projectRoot | Out-Null

$url = "http://127.0.0.1:5173/"
$deadline = (Get-Date).AddSeconds(30)
do {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { break }
  } catch {
    Start-Sleep -Milliseconds 500
  }
} while ((Get-Date) -lt $deadline)

if ((Get-Date) -ge $deadline) {
  throw "The workbench UI did not start within 30 seconds."
}
Start-Process $url
Write-Output "Personal Workbench is available at $url"
