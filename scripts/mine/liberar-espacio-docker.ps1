# EvoGuard — libera espacio de Docker cuando el disco virtual se llenó (errores EROFS / Input/output error).
#
# 1) Reinicia Docker Desktop y WSL para que el disco vuelva a montarse con escritura.
# 2) Muestra cuánto ocupa cada cosa.
# 3) Borra del volumen evoguard-bases las cachés de descarga (npm, yarn, pnpm) y los workspaces de las bases
#    descartadas (scripts\mine\bases-descartadas.txt). Conserva las 20 familias del piloto y las bases verdes.
# 4) Borra la caché de construcción y las imágenes sin etiqueta. No toca las imágenes evoguard-real-sxxx.
#
# Uso: doble clic en liberar-espacio-docker.cmd. Después, vuelve a lanzar verificar-bases-ronda3.cmd.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
. (Join-Path $root 'scripts\real\lib-docker.ps1')
$log = Join-Path $root (".artifacts\liberar-espacio-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
New-Item -ItemType Directory -Force -Path (Join-Path $root '.artifacts') | Out-Null
Start-Transcript -Path $log -Append | Out-Null
try {
  Paso 'Reiniciando Docker Desktop y WSL (el disco quedó en solo lectura)'
  Get-Process 'Docker Desktop', 'com.docker.backend', 'com.docker.build' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  wsl --shutdown 2>&1 | Out-Null
  Start-Sleep 10
  Asegurar-Docker

  Paso 'Espacio antes'
  docker system df
  $descartadas = Get-Content (Join-Path $root 'scripts\mine\bases-descartadas.txt') | Where-Object { $_ -and -not $_.StartsWith('#') }
  $lista = ($descartadas | ForEach-Object { "/cache/repos/_baselines/$_" }) -join ' '
  $script = "df -h /cache; echo; du -sh /cache/* /cache/repos/_baselines 2>/dev/null | sort -h | tail -12; " +
            "rm -rf /cache/npm /cache/yarn /cache/pnpm /cache/pnpm-store /cache/.pnpm-store /root/.cache 2>/dev/null; " +
            "for d in $lista; do if [ -d `$d ]; then echo borrando `$d; rm -rf `$d; fi; done; " +
            "cd /cache/repos/_baselines 2>/dev/null && for d in */; do git -C `$d worktree prune 2>/dev/null; done; echo; df -h /cache"
  Paso 'Limpiando el volumen evoguard-bases'
  docker run --rm -v evoguard-bases:/cache node:24-bookworm bash -c $script

  Paso 'Limpiando caché de construcción e imágenes sin etiqueta'
  docker builder prune -f
  docker image prune -f
  docker container prune -f

  Paso 'Espacio después'
  docker system df
  Write-Host "`nListo. Ahora vuelve a lanzar scripts\mine\verificar-bases-ronda3.cmd (continúa donde quedó)." -ForegroundColor Green
  Write-Host "Registro: $log"
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registro completo: $log"
}
finally { Stop-Transcript | Out-Null }
