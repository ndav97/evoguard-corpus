# EvoGuard — prepara la imagen Docker de cada familia semi-real (R2).
#
# Para cada familia: clona el repositorio en su commit V0, instala sus dependencias con su lockfile
# (esto usa Internet) y verifica SIN red que la suite pasa dos veces igual, que los parches de referencia
# se aplican y que la zona del cambio existe. Resultado: imágenes evoguard-real-sxxx:v0 y config\real-bases.json.
# Ocupa 0,5–2 GB por familia. Se puede repetir: rehace la imagen y actualiza su entrada.
#
# Uso (PowerShell o doble clic en preparar-imagenes.cmd):
#   .\scripts\real\preparar-imagenes.ps1                    # las 20 familias
#   .\scripts\real\preparar-imagenes.ps1 -Familias S010,S005

param([string[]]$Familias = @('S001', 'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008', 'S009', 'S010', 'S011', 'S012', 'S013', 'S014', 'S015', 'S016', 'S017', 'S018', 'S019', 'S020'))

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
  # Cada familia declara su versión de Node (node: "24", "22"…): se descargan todas las que usen.
  $nodos = Get-ChildItem (Join-Path $root 'families-real') -Filter family.yaml -Recurse |
    Select-String -Pattern '^node:\s*"?(\d+)"?' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique
  foreach ($v in $nodos) {
    Paso "Descargando la imagen base node:$v-bookworm (solo la primera vez)"
    docker pull "node:$v-bookworm"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar node:$v-bookworm. ¿Hay conexión a Internet?" }
  }
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
