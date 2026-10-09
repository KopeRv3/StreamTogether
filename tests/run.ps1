# Ejecuta la suite E2E contra un backend limpio.
#
# Reinicia el servidor porque los limitadores de peticiones viven en memoria:
# si el proceso anterior ya consumió el cupo, la prueba recibiría un 429
# sin ningún sentido y parecería un fallo real.
#
# Uso:  .\tests\run.ps1

param(
  [switch]$KeepServer
)

$ErrorActionPreference = 'Stop'
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root "server"

Write-Host "Deteniendo servidores previos..." -ForegroundColor Yellow
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*RandomProjects*src/index.ts*" } |
  ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; Write-Host "  detenido PID $($_.ProcessId)" }
    catch { Write-Host "  no se pudo detener PID $($_.ProcessId)" }
  }

Start-Sleep -Seconds 2

Write-Host "Levantando backend..." -ForegroundColor Yellow
$job = Start-Process -PassThru -WindowStyle Hidden -FilePath "node" `
  -ArgumentList "node_modules\tsx\dist\cli.mjs", "src/index.ts" `
  -WorkingDirectory $serverDir `
  -RedirectStandardOutput (Join-Path $env:TEMP "streamtogether-server.log") `
  -RedirectStandardError (Join-Path $env:TEMP "streamtogether-server.err")

# Espera activa a que responda el health check
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 750
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}

if (-not $ready) {
  Write-Host "El backend no respondió a tiempo." -ForegroundColor Red
  Get-Content (Join-Path $env:TEMP "streamtogether-server.err") -ErrorAction SilentlyContinue | Select-Object -Last 20
  exit 1
}

Write-Host "Backend listo. Ejecutando pruebas...`n" -ForegroundColor Green

Push-Location $root
& node tests/e2e.mjs
$code = $LASTEXITCODE
Pop-Location

if (-not $KeepServer) {
  Write-Host "`nDeteniendo backend..." -ForegroundColor Yellow
  try { Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue } catch { }
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like "*RandomProjects*src/index.ts*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

exit $code