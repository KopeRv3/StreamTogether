# Ejecuta toda la suite de pruebas contra un backend limpio.
#
# Reinicia el servidor porque los limitadores de peticiones viven en memoria:
# si el proceso anterior ya consumio el cupo, las pruebas recibirian un 429
# sin ningun sentido y parecerian fallos reales.
#
# Uso:
#   .\tests\run.ps1                # todo
#   .\tests\run.ps1 -KeepServer    # deja el backend levantado al terminar

param(
  [switch]$KeepServer
)

$ErrorActionPreference = 'Stop'
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root "server"
$logOut = Join-Path $env:TEMP "streamtogether-server.log"
$logErr = Join-Path $env:TEMP "streamtogether-server.err"

function Stop-Backend {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match "RandomProjects.*(src/index\.ts|tsx/dist/cli)" } |
    ForEach-Object {
      try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; Write-Host "  detenido PID $($_.ProcessId)" -ForegroundColor DarkGray }
      catch { }
    }
  Start-Sleep -Seconds 2
}

function Start-Backend {
  Write-Host "Levantando backend..." -ForegroundColor Yellow

  $proc = Start-Process -PassThru -WindowStyle Hidden -FilePath "node" `
    -ArgumentList "node_modules\tsx\dist\cli.mjs", "src/index.ts" `
    -WorkingDirectory $serverDir `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr

  # Espera activa: no basta con dormir, el arranque varia
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 750
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { return $proc }
    } catch { }
  }

  Write-Host "El backend no respondio a tiempo." -ForegroundColor Red
  Get-Content $logErr -ErrorAction SilentlyContinue | Select-Object -Last 20
  return $null
}

function Invoke-Suite {
  param([string]$File, [string]$Title)

  Write-Host ""
  Write-Host ("#" * 62) -ForegroundColor Cyan
  Write-Host "# $Title" -ForegroundColor Cyan
  Write-Host ("#" * 62) -ForegroundColor Cyan

  Push-Location $root
  # Node escribe en stderr, que PowerShell convierte en terminating error.
  # Se captura la salida en un archivo y se imprime aparte para que $LASTEXITCODE
  # refleje de verdad el codigo de salida de node.
  $outFile = Join-Path $env:TEMP ("st-suite-" + [IO.Path]::GetFileNameWithoutExtension($File) + ".log")
  & node $File *> $outFile
  $code = $LASTEXITCODE
  Get-Content $outFile | Write-Host
  Remove-Item $outFile -ErrorAction SilentlyContinue
  Pop-Location

  return $code
}

# --------------------------------------------------------------------------
Stop-Backend

$proc = Start-Backend
if (-not $proc) { exit 1 }

Write-Host "Backend listo." -ForegroundColor Green

$codigos = @{}

$codigos["e2e"] = Invoke-Suite "tests/e2e.mjs" "Flujo completo (71 comprobaciones)"

# La suite de robustez satura el limitador de auth a proposito (para comprobar
# que el bloqueo funciona), asi que necesita un backend con estado limpio.
Stop-Backend
$proc = Start-Backend
if (-not $proc) { exit 1 }
$codigos["resiliencia"] = Invoke-Suite "tests/resilience.mjs" "Robustez (el servidor nunca debe morir)"

# El proxy necesita el frontend de Vite
$webListening = $false
try {
  $null = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2
  $webListening = $true
} catch { }

if ($webListening) {
  # Cada suite agota el limitador de registro a proposito, asi que todas
  # necesitan un backend limpio
  Stop-Backend
  $proc = Start-Backend
  if (-not $proc) { exit 1 }
  $codigos["sync"] = Invoke-Suite "tests/sync.mjs" "Sincronizacion extremo a extremo"

  Stop-Backend
  $proc = Start-Backend
  if (-not $proc) { exit 1 }
  $codigos["proxy"] = Invoke-Suite "tests/proxy-check.mjs" "Proxy de Vite (tiempo real)"
} else {
  Write-Host ""
  Write-Host "(Se omite la prueba del proxy: Vite no esta corriendo en el 5173)" -ForegroundColor Yellow
  Write-Host "  Para incluirla:  npm run dev:web   y luego  npm run test:all" -ForegroundColor Yellow
}

if (-not $KeepServer) {
  Write-Host ""
  Write-Host "Deteniendo backend..." -ForegroundColor Yellow
  Stop-Backend
}

# --------------------------------------------------------------------------
Write-Host ""
Write-Host ("=" * 62)
$fallos = @()
foreach ($k in $codigos.Keys) {
  if ($codigos[$k] -ne 0) { $fallos += $k }
}

if ($fallos.Count -eq 0) {
  Write-Host "  TODAS LAS SUITES EN VERDE" -ForegroundColor Green
} else {
  Write-Host "  SUITES CON FALLOS: $($fallos -join ', ')" -ForegroundColor Red
}
Write-Host ("=" * 62)

if ($fallos.Count -eq 0) { exit 0 } else { exit 1 }