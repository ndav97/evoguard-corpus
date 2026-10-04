# EvoGuard — verificación de las bases V0 del estrato semi-real.
#
# Para cada repo de scripts\mine\repos-v0.txt (en orden de ranking):
#   1) descarga el repo y fija el commit V0 exacto;
#   2) instala sus dependencias (CON red);
#   3) ejecuta su suite de tests dos veces (SIN red) y anota si queda en verde.
#
# Todo ocurre dentro de contenedores Docker desechables: el código de terceros no
# toca tu Windows. Los repos y sus dependencias se guardan en un volumen de Docker
# llamado "evoguard-bases"; los resultados, en .artifacts\baselines\ del proyecto.
#
# Uso (desde PowerShell, en la carpeta del proyecto):
#   .\scripts\mine\verificar-bases.ps1                 # piloto: las 5 primeras bases
#   .\scripts\mine\verificar-bases.ps1 -Cantidad 46    # la selección completa
#   .\scripts\mine\verificar-bases.ps1 -Limpiar        # borra el volumen (libera disco)
#   .\scripts\mine\verificar-bases.ps1 -Cantidad 80 -Lista scripts/mine/repos-v0-ronda2.txt -Salida .artifacts/baselines-ronda2
#
# Si se interrumpe (apagón, ventana cerrada), vuelve a lanzar el mismo comando:
# detiene lo que hubiera quedado corriendo y continúa donde se quedó (las suites
# que agotaron el tiempo se reintentan).

param(
  [int]$Cantidad = 5,
  [switch]$Limpiar,
  # Lista de bases (owner/repo@SHA) y carpeta de resultados; por defecto, la primera ronda de minería.
  [string]$Lista = 'scripts/mine/repos-v0.txt',
  [string]$Salida = '.artifacts/baselines'
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$imagen = 'node:24-bookworm'
$volumen = 'evoguard-bases'
$salidaWin = Join-Path $root ($Salida -replace '/', '\')
New-Item -ItemType Directory -Force -Path $salidaWin | Out-Null
$log = Join-Path $salidaWin ("verificar-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
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

  if ($Limpiar) {
    Paso "Borrando el volumen $volumen"
    docker volume rm $volumen
    Write-Host 'Listo. Los resultados en .artifacts\baselines se conservan.'
    return
  }

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
  $minero = "node scripts/mine/mine-baselines.mjs --repos $Lista --workdir /cache/repos --out $Salida --concurrency 4 --workers 2 --test-timeout 20 --verify $Cantidad"

  Paso "Fase 1 de 2: descargar repos e instalar dependencias (con red) — $Cantidad bases"
  docker @comun $imagen bash -c "(corepack enable || npm i -g corepack && corepack enable) && $minero --verify-step install"
  if ($LASTEXITCODE -ne 0) { throw "La fase de instalación terminó con código $LASTEXITCODE" }

  Paso 'Fase 2 de 2: ejecutar las suites de tests (sin red)'
  docker @comun --network none $imagen bash -c "(corepack enable || npm i -g corepack && corepack enable) && $minero --verify-step test"
  if ($LASTEXITCODE -ne 0) { throw "La fase de tests terminó con código $LASTEXITCODE" }

  Paso 'Resultado'
  $csv = Join-Path $salidaWin 'baselines.csv'
  $filas = Import-Csv $csv | Where-Object { $_.baseline -ne '' }
  $filas | Select-Object rank, repo, baseline, baseline_tests, baseline_seconds | Format-Table -AutoSize
  $filas | Group-Object baseline | Select-Object @{n='estado';e={$_.Name}}, @{n='bases';e={$_.Count}} | Format-Table -AutoSize
  $verdes = @($filas | Where-Object { $_.baseline -like 'GREEN*' }).Count
  Write-Host "$verdes de $($filas.Count) bases en verde." -ForegroundColor Green
  Write-Host "Detalle por repo: $Salida/verify/   ·   Registro: $log"
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registro completo: $log"
}
finally {
  [EvoGuard.Energia]::SetThreadExecutionState([uint32]2147483648) | Out-Null
  Stop-Transcript | Out-Null
}
