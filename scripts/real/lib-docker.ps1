# Funciones comunes de los lanzadores de Windows del estrato semi-real (se cargan con ". .\lib-docker.ps1").

function Paso($texto) { Write-Host "`n=== $texto ($(Get-Date -Format 'HH:mm:ss')) ===" -ForegroundColor Cyan }

# Mientras corre, Windows no suspende el equipo (se restablece con Permitir-Suspension).
function Evitar-Suspension {
  Add-Type -Namespace EvoGuard -Name Energia -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' -ErrorAction SilentlyContinue
  [EvoGuard.Energia]::SetThreadExecutionState([uint32]2147483649) | Out-Null
}
function Permitir-Suspension { [EvoGuard.Energia]::SetThreadExecutionState([uint32]2147483648) | Out-Null }

# ¿Responde el motor de Docker? Con límite de tiempo: si Docker está colgado, `docker info` tampoco vuelve.
function DockerResponde([int]$segundos = 60) {
  $o = [IO.Path]::GetTempFileName(); $e = [IO.Path]::GetTempFileName()
  try {
    $p = Start-Process docker -ArgumentList 'info', '--format', '{{.ServerVersion}}' -NoNewWindow -PassThru -RedirectStandardOutput $o -RedirectStandardError $e
    $null = $p.Handle
    if (-not $p.WaitForExit($segundos * 1000)) { taskkill /PID $p.Id /T /F 2>&1 | Out-Null; return $false }
    return ($p.ExitCode -eq 0)
  } catch { return $false }
  finally { Remove-Item $o, $e -ErrorAction SilentlyContinue }
}

function Buscar-DockerDesktop {
  $candidatos = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  )
  $cmd = Get-Command docker -ErrorAction SilentlyContinue
  if ($cmd) { $candidatos += (Join-Path (Split-Path (Split-Path (Split-Path $cmd.Source))) 'Docker Desktop.exe') }
  return ($candidatos | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1)
}

# Cierra Docker Desktop y su máquina WSL, lo vuelve a abrir y espera hasta 5 minutos a que responda.
function Reiniciar-Docker {
  Write-Host 'Reiniciando Docker Desktop (2-4 minutos)...' -ForegroundColor Yellow
  $desktop = Buscar-DockerDesktop
  if (-not $desktop) { throw 'No encuentro Docker Desktop. Ábrelo desde el menú Inicio, espera a "Engine running" y vuelve a ejecutar.' }
  Get-Process 'Docker Desktop', 'com.docker.backend', 'com.docker.build', 'docker' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  wsl --shutdown 2>&1 | Out-Null
  Start-Sleep 8
  Start-Process $desktop
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep 5; if (DockerResponde 20) { Write-Host 'Docker OK'; return } }
  throw 'Docker Desktop no terminó de arrancar. Ábrelo desde el menú Inicio, espera a "Engine running" (si se queda en error, reinicia Windows) y vuelve a ejecutar.'
}

# Comprueba Docker Desktop; si no responde, lo abre (o lo reinicia) y espera hasta 5 minutos.
function Asegurar-Docker {
  if (DockerResponde) { Write-Host 'Docker OK'; return }
  if (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue) {
    Write-Host 'Docker Desktop está abierto pero su motor no responde.' -ForegroundColor Yellow
    Reiniciar-Docker; return
  }
  $desktop = Buscar-DockerDesktop
  if (-not $desktop) { throw 'No encuentro Docker Desktop. Ábrelo desde el menú Inicio, espera a "Engine running" y vuelve a ejecutar.' }
  Write-Host 'Abriendo Docker Desktop (1-3 minutos)...'
  Start-Process $desktop
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep 5; if (DockerResponde 20) { Write-Host 'Docker OK'; return } }
  throw 'Docker Desktop no terminó de arrancar. Ábrelo desde el menú Inicio, espera a "Engine running" (si se queda en error, reinicia Windows) y vuelve a ejecutar.'
}

# Elimina los contenedores de EvoGuard que haya dejado una ejecución interrumpida.
function Limpiar-Contenedores {
  $nombres = @(docker container ls --all --filter 'label=org.evoguard.role' --format '{{.Names}}' 2>$null) | Where-Object { $_ -match '^evoguard-' }
  if ($nombres.Count) { Write-Host "Eliminando $($nombres.Count) contenedores remanentes"; docker rm --force @nombres 2>&1 | Out-Null }
}

# Ejecuta `node <argumentos>` con vigilante: muestra la salida, la guarda en $registro y, si pasa de $limiteMin
# minutos, termina el proceso y sus hijos (docker incluido). Devuelve 'PASS', 'FALLO' o 'LIMITE'.
function Ejecutar-Vigilado([string[]]$argumentos, [string]$registro, [int]$limiteMin) {
  $err = "$registro.err"
  $p = Start-Process node -ArgumentList $argumentos -NoNewWindow -PassThru -RedirectStandardOutput $registro -RedirectStandardError $err -WorkingDirectory (Get-Location)
  $null = $p.Handle
  $inicio = Get-Date; $vistas = 0
  $mostrar = {
    $lineas = @(Get-Content $registro -Encoding UTF8 -ErrorAction SilentlyContinue)
    if ($lineas.Count -gt $vistas) { $lineas[$vistas..($lineas.Count - 1)] | ForEach-Object { Write-Host $_ }; $script:vistasNuevas = $lineas.Count } else { $script:vistasNuevas = $vistas }
  }
  while (-not $p.WaitForExit(30000)) {
    & $mostrar; $vistas = $script:vistasNuevas
    if (((Get-Date) - $inicio).TotalMinutes -gt $limiteMin) {
      Write-Host "Superó el límite de $limiteMin minutos: se detiene (probablemente Docker dejó de responder)." -ForegroundColor Yellow
      taskkill /PID $p.Id /T /F 2>&1 | Out-Null
      $null = $p.WaitForExit(60000)
      return 'LIMITE'
    }
  }
  & $mostrar
  if ($p.ExitCode -ne 0) {
    $cola = @(Get-Content $err -Encoding UTF8 -ErrorAction SilentlyContinue | Select-Object -Last 25)
    if ($cola.Count) { Write-Host '--- errores ---' -ForegroundColor Yellow; $cola | ForEach-Object { Write-Host $_ } }
    return 'FALLO'
  }
  return 'PASS'
}

# Memoria por contenedor: 75 % de la memoria asignada a Docker Desktop (mínimo 2 GB).
function Fijar-Memoria {
  $memDocker = [int64](docker info --format '{{.MemTotal}}')
  $env:EVOGUARD_REAL_MEMORY_MB = [string][math]::Max(2048, [math]::Floor($memDocker * 0.75 / 1MB))
  Write-Host "Memoria por contenedor: $($env:EVOGUARD_REAL_MEMORY_MB) MB"
}
