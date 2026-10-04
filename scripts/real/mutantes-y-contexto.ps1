# EvoGuard — tras preparar y ensayar S011–S020: repite el ensayo de S015 y mide la fuerza de los tests ocultos
# (mutantes) y el ajuste del primer mensaje a la ventana de los modelos locales (contexto). Sin modelos, sin red.
# Resultados: docs\verification\real-rehearsal-s015.json, real-mutants-s0xx.json y real-context.json.

param([string[]]$Familias = @('S011', 'S012', 'S013', 'S014', 'S015', 'S016', 'S017', 'S018', 'S019', 'S020'))

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
. (Join-Path $PSScriptRoot 'lib-docker.ps1')
New-Item -ItemType Directory -Force -Path (Join-Path $root '.artifacts\real') | Out-Null
$log = Join-Path $root (".artifacts\real\mutantes-contexto-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $log -Append | Out-Null
Evitar-Suspension
$problemas = @()
try {
  Paso 'Comprobando Docker'
  Asegurar-Docker
  Fijar-Memoria
  $Familias = $Familias | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
  Paso 'Ensayando S015 de nuevo'
  # 2>&1 para que los errores de Node queden en el registro (Start-Transcript no guarda stderr de procesos nativos).
  node runner/real/rehearse.mjs S015 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) { $problemas += 'ensayo S015' }
  foreach ($f in $Familias) {
    Paso "Mutantes de $f"
    node runner/real/mutants.mjs $f 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { $problemas += "mutantes $f" }
  }
  Paso 'Contexto de las 20 familias'
  node runner/real/context-check.mjs 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) { $problemas += 'contexto' }
  Paso 'Resumen'
  if ($problemas.Count) { Write-Host "Con problemas: $($problemas -join ', ')" -ForegroundColor Yellow } else { Write-Host 'Todo terminó sin errores.' -ForegroundColor Green }
  Write-Host "Detalle: docs\verification\   ·   Registro: $log"
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registro completo: $log"
}
finally {
  Permitir-Suspension
  Stop-Transcript | Out-Null
}
