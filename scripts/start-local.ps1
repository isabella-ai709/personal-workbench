$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw "Node.js 22.5 or newer is required."
}

$tsxCli = Join-Path $projectRoot "node_modules\tsx\dist\cli.mjs"
$viteCli = Join-Path $projectRoot "node_modules\vite\bin\vite.js"
if (-not (Test-Path -LiteralPath $tsxCli) -or -not (Test-Path -LiteralPath $viteCli)) {
  throw "Project dependencies are missing. Run pnpm install first."
}

& $nodeCommand.Source $tsxCli (Join-Path $projectRoot "scripts\migrate.ts")
if ($LASTEXITCODE -ne 0) {
  throw "Database migration failed."
}

$apiUrl = "http://127.0.0.1:4310/api/dashboard"
$url = "http://127.0.0.1:5173/"

try {
  Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
} catch {
  Start-Process -WindowStyle Hidden -FilePath $nodeCommand.Source -ArgumentList $tsxCli, (Join-Path $projectRoot "src\server\main.ts") -WorkingDirectory $projectRoot | Out-Null
}

try {
  Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
} catch {
  Start-Process -WindowStyle Hidden -FilePath $nodeCommand.Source -ArgumentList $viteCli, "--host", "127.0.0.1", "--port", "5173" -WorkingDirectory $projectRoot | Out-Null
}

$deadline = (Get-Date).AddSeconds(30)
do {
  try {
    $uiResponse = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    $apiResponse = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 2
    if (
      $uiResponse.StatusCode -ge 200 -and $uiResponse.StatusCode -lt 500 -and
      $apiResponse.StatusCode -ge 200 -and $apiResponse.StatusCode -lt 500
    ) { break }
  } catch {
    Start-Sleep -Milliseconds 500
  }
} while ((Get-Date) -lt $deadline)

if ((Get-Date) -ge $deadline) {
  throw "The workbench UI did not start within 30 seconds."
}
Start-Process $url
Write-Output "Personal Workbench is available at $url"
