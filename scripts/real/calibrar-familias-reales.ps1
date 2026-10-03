# EvoGuard — calibración de las familias semi-reales (families-real\Sxxx-*).
#
# Para cada familia y turno comprueba, sobre la base V0 ya instalada por
# verificar-bases, que los tests ocultos fallan antes del cambio, pasan con la
# implementación de referencia, no rompen la suite del repo y son estables.
# Todo corre en un contenedor Docker SIN red. Resultados: .artifacts\real-calibration\
#
# Uso (desde PowerShell o con doble clic en calibrar-familias-reales.cmd):
#   .\scripts\real\calibrar-familias-reales.ps1              # todas las familias
#   .\scripts\real\calibrar-familias-reales.ps1 -Familia S001 # solo una
#   .\scripts\real\calibrar-familias-reales.ps1 -Familia S011,S012   # varias (lista separada por comas)

param(
  [string[]]$Familia = @()
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$imagen = 'node:24-bookworm'
$volumen = 'evoguard-bases'
New-Item -ItemType Directory -Force -Path (Join-Path $root '.artifacts\real-calibration') | Out-Null
$log = Join-Path $root (".artifacts\real-calibration\calibrar-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $log -Append | Out-Null

function Paso($texto) { Write-Host "`n=== $texto ($(Get-Date -Format 'HH:mm:ss')) ===" -ForegroundColor Cyan }

# Mientras corre, Windows no suspende el equipo (se restablece al terminar).
# Ojo: cerrar la tapa del portátil puede suspenderlo igual, según la configuración de energía.
Add-Type -Namespace EvoGuard -Name Energia -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[EvoGuard.Energia]::SetThreadExecutionState([uint32]2147483649) | Out-Null

try {
  Paso 'Comprobando Docker'
  function DockerResponde { $null = docker info 2>&1; return ($LASTEXITCODE -eq 0) }
  function EsperarDocker($minutos) {
    for ($i = 0; $i -lt ($minutos * 12); $i++) { Start-Sleep 5; if (DockerResponde) { return $true } }
    return $false
  }
  if (-not (DockerResponde)) {
    # Dónde está Docker Desktop: rutas habituales y, si no, junto al comando docker.
    $candidatos = @(
      "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
      "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
      "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )
    $cmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($cmd) { $candidatos += (Join-Path (Split-Path (Split-Path (Split-Path $cmd.Source))) 'Docker Desktop.exe') }
    $desktop = $candidatos | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

    if (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue) {
      # Está abierto pero su motor no responde (suele pasar tras una sobrecarga): se reinicia.
      Write-Host 'Docker Desktop está abierto pero su motor no responde. Reiniciándolo (2-4 minutos)...' -ForegroundColor Yellow
      Get-Process 'Docker Desktop', 'com.docker.backend', 'com.docker.build' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
      wsl --shutdown 2>&1 | Out-Null
      Start-Sleep 8
    } else {
      Write-Host 'Abriendo Docker Desktop (1-3 minutos)...'
    }
    if (-not $desktop) { throw 'No encuentro el programa Docker Desktop. Ábrelo tú desde el menú Inicio, espera a que diga "Engine running" y vuelve a ejecutar.' }
    Start-Process $desktop
    if (-not (EsperarDocker 5)) { throw 'Docker Desktop no terminó de arrancar. Ábrelo desde el menú Inicio, espera a que diga "Engine running" (si se queda en error, reinicia Windows) y vuelve a ejecutar.' }
  }
  Write-Host 'Docker OK'

  # Tope de memoria del contenedor (75 % de la que tiene Docker): si una suite se pasa,
  # falla solo esa suite en lugar de tumbar el motor de Docker.
  $memDocker = [int64](docker info --format '{{.MemTotal}}')
  $memTope = [math]::Max(2048, [math]::Floor($memDocker * 0.75 / 1MB))
  Write-Host "Memoria para las suites: $memTope MB"

  # Si quedó corriendo una verificación anterior (por ejemplo, se cerró la ventana), se detiene.
  $viejos = docker ps -q --filter "ancestor=$imagen"
  if ($viejos) { Write-Host 'Deteniendo una verificación anterior que seguía en marcha...'; docker rm -f $viejos | Out-Null }

  Paso "Descargando la imagen $imagen (solo la primera vez)"
  docker pull $imagen
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar la imagen. ¿Hay conexión a Internet?' }

  # Parámetros comunes: el proyecto se monta en /w; repos, dependencias y cachés en el volumen.
  $comun = @(
    'run', '--rm', '--init', "--memory=${memTope}m", "--memory-swap=${memTope}m",
    '-v', "${volumen}:/cache",
    '-v', "${root}:/w",
    '-w', '/w',
    '-e', 'COREPACK_ENABLE_DOWNLOAD_PROMPT=0',
    '-e', 'COREPACK_HOME=/cache/corepack',
    '-e', 'npm_config_cache=/cache/npm',
    '-e', 'YARN_CACHE_FOLDER=/cache/yarn',
    '-e', 'NODE_OPTIONS=--max-old-space-size=3072'
  )
  $lista = ($Familia | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join ','
  $filtro = if ($lista) { "--family $lista" } else { '' }
  if ($lista) { Write-Host "Familias: $lista" }
  Paso 'Calibrando (sin red)'
  docker @comun --network none $imagen bash -c "node scripts/real/calibrar.mjs --cache /cache/repos --out .artifacts/real-calibration $filtro"
  if ($LASTEXITCODE -ne 0) { throw "La calibración terminó con código $LASTEXITCODE" }

  Write-Host "`nDetalle por familia: .artifacts\real-calibration\   ·   Registro: $log"
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registro completo: $log"
}
finally {
  [EvoGuard.Energia]::SetThreadExecutionState([uint32]2147483648) | Out-Null
  Stop-Transcript | Out-Null
}
