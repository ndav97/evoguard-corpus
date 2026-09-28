# EvoGuard — prepara la imagen Docker de cada familia semi-real (R2).
#
# Para cada familia: clona el repositorio en su commit V0, instala sus dependencias con su lockfile
# (esto usa Internet) y verifica SIN red que la suite pasa dos veces igual, que los parches de referencia
# se aplican y que la zona del cambio existe. Resultado: imágenes evoguard-real-sxxx:v0 y config\real-bases.json.
# Ocupa 0,5–2 GB por familia. Se puede repetir: rehace la imagen y actualiza su entrada.
#
# Uso (PowerShell o doble clic en preparar-imagenes.cmd):
#   .\scripts\real\preparar-imagenes.ps1                    # las 10 familias
#   .\scripts\real\preparar-imagenes.ps1 -Familias S010,S005

param([string[]]$Familias = @('S001', 'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008', 'S009', 'S010'))

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
. (Join-Path $PSScriptRoot 'lib-docker.ps1')
New-Item -ItemType Directory -Force -Path (Join-Path $root '.artifacts\real') | Out-Null
$log = Join-Path $root (".artifacts\real\preparar-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $log -Append | Out-Null
Evitar-Suspension
$fallidas = @()
try {
  Paso 'Comprobando Docker'
  Asegurar-Docker
  Fijar-Memoria
  Paso 'Descargando la imagen base node:24-bookworm (solo la primera vez)'
  docker pull node:24-bookworm
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar node:24-bookworm. ¿Hay conexión a Internet?' }
  if (-not (Test-Path (Join-Path $root 'node_modules\yaml'))) { Paso 'Instalando dependencias del runner'; npm ci --no-audit --no-fund }
  $Familias = $Familias | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
  foreach ($f in $Familias) {
    Paso "Preparando $f"
    node runner/real/prepare.mjs $f
    if ($LASTEXITCODE -ne 0) { $fallidas += $f; Write-Host "$f no quedó verificada (ver el registro)." -ForegroundColor Yellow }
  }
  Paso 'Resumen'
  if ($fallidas.Count) { Write-Host "Sin verificar: $($fallidas -join ', ')" -ForegroundColor Yellow } else { Write-Host 'Todas las imágenes quedaron verificadas.' -ForegroundColor Green }
  Write-Host "Detalle: config\real-bases.json   ·   Registro: $log"
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registro completo: $log"
}
finally {
  Permitir-Suspension
  Stop-Transcript | Out-Null
}
