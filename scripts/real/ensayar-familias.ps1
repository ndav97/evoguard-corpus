# EvoGuard — ensayo del pipeline con cada familia semi-real, SIN modelos (R3/R4).
#
# Con la imagen ya preparada (preparar-imagenes.cmd), un "constructor" guionado aplica los parches de referencia y
# el pipeline completo los evalúa como si fueran de un modelo: contenedores sin red, suite visible, oráculo con los
# tests ocultos, control de alcance e historia reconstruida por hash (V1 → V2 → V3). En V1 prueba además los
# rechazos: borrar un test (alcance), no cambiar nada (oráculo) y código roto (reparación con feedback visible).
# Resultado por familia: docs\verification\real-rehearsal-sxxx.json (lo exige el preflight antes de generar).
#
# Uso (PowerShell o doble clic en ensayar-familias.cmd):
#   .\scripts\real\ensayar-familias.ps1                    # las 20 familias
#   .\scripts\real\ensayar-familias.ps1 -Familias S010,S005

param([string[]]$Familias = @('S001', 'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008', 'S009', 'S010', 'S011', 'S012', 'S013', 'S014', 'S015', 'S016', 'S017', 'S018', 'S019', 'S020'))

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
. (Join-Path $PSScriptRoot 'lib-docker.ps1')
New-Item -ItemType Directory -Force -Path (Join-Path $root '.artifacts\real') | Out-Null
$log = Join-Path $root (".artifacts\real\ensayar-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $log -Append | Out-Null
Evitar-Suspension
$fallidas = @()
try {
  Paso 'Comprobando Docker'
  Asegurar-Docker
  Fijar-Memoria
  # Ensayo general del pipeline (familia de prueba S900): el preflight lo exige con el código actual.
  Paso 'Ensayo general del pipeline (S900)'
  node runner/real/rehearse.mjs --mini
  if ($LASTEXITCODE -ne 0) { $fallidas += 'S900 (ensayo general)'; Write-Host 'El ensayo general no pasó (ver el registro).' -ForegroundColor Yellow }
  $Familias = $Familias | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
  foreach ($f in $Familias) {
    Paso "Ensayando $f"
    node runner/real/rehearse.mjs $f
    if ($LASTEXITCODE -ne 0) { $fallidas += $f; Write-Host "${f}: el ensayo no pasó (ver el registro)." -ForegroundColor Yellow }
  }
  Paso 'Resumen'
  if ($fallidas.Count) { Write-Host "Con problemas: $($fallidas -join ', ')" -ForegroundColor Yellow } else { Write-Host 'Todas las familias ensayadas pasaron.' -ForegroundColor Green }
  Write-Host "Detalle: docs\verification\real-rehearsal-*.json   ·   Registro: $log"
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registro completo: $log"
}
finally {
  Permitir-Suspension
  Stop-Transcript | Out-Null
}
