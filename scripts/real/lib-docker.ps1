# Funciones comunes de los lanzadores de Windows del estrato semi-real (se cargan con ". .\lib-docker.ps1").

function Paso($texto) { Write-Host "`n=== $texto ($(Get-Date -Format 'HH:mm:ss')) ===" -ForegroundColor Cyan }

# Mientras corre, Windows no suspende el equipo (se restablece con Permitir-Suspension).
function Evitar-Suspension {
  Add-Type -Namespace EvoGuard -Name Energia -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' -ErrorAction SilentlyContinue
  [EvoGuard.Energia]::SetThreadExecutionState([uint32]2147483649) | Out-Null
}
function Permitir-Suspension { [EvoGuard.Energia]::SetThreadExecutionState([uint32]2147483648) | Out-Null }

function DockerResponde { $null = docker info 2>&1; return ($LASTEXITCODE -eq 0) }

# Comprueba Docker Desktop; si no responde, lo abre (o lo reinicia) y espera hasta 5 minutos.
function Asegurar-Docker {
  if (DockerResponde) { Write-Host 'Docker OK'; return }
  $candidatos = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  )
  $cmd = Get-Command docker -ErrorAction SilentlyContinue
  if ($cmd) { $candidatos += (Join-Path (Split-Path (Split-Path (Split-Path $cmd.Source))) 'Docker Desktop.exe') }
  $desktop = $candidatos | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue) {
    Write-Host 'Docker Desktop está abierto pero su motor no responde. Reiniciándolo (2-4 minutos)...' -ForegroundColor Yellow
    Get-Process 'Docker Desktop', 'com.docker.backend', 'com.docker.build' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    wsl --shutdown 2>&1 | Out-Null
    Start-Sleep 8
  } else { Write-Host 'Abriendo Docker Desktop (1-3 minutos)...' }
  if (-not $desktop) { throw 'No encuentro Docker Desktop. Ábrelo desde el menú Inicio, espera a "Engine running" y vuelve a ejecutar.' }
  Start-Process $desktop
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep 5; if (DockerResponde) { Write-Host 'Docker OK'; return } }
  throw 'Docker Desktop no terminó de arrancar. Ábrelo desde el menú Inicio, espera a "Engine running" (si se queda en error, reinicia Windows) y vuelve a ejecutar.'
}

# Memoria por contenedor: 75 % de la memoria asignada a Docker Desktop (mínimo 2 GB).
function Fijar-Memoria {
  $memDocker = [int64](docker info --format '{{.MemTotal}}')
  $env:EVOGUARD_REAL_MEMORY_MB = [string][math]::Max(2048, [math]::Floor($memDocker * 0.75 / 1MB))
  Write-Host "Memoria por contenedor: $($env:EVOGUARD_REAL_MEMORY_MB) MB"
}
