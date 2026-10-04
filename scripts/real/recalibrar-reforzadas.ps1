# EvoGuard — recalibra las familias con tests ocultos reforzados tras el triaje de mutantes y vuelve a medir mutantes.
# Uso: doble clic en recalibrar-reforzadas.cmd, o .\scripts\real\recalibrar-reforzadas.ps1 -Familias S012,S016,S018

param([string[]]$Familias = @('S012', 'S016', 'S018'))

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$Familias = $Familias | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
$lista = $Familias -join ','
& (Join-Path $PSScriptRoot 'calibrar-familias-reales.ps1') -Familia $lista
. (Join-Path $PSScriptRoot 'lib-docker.ps1')
$log = Join-Path $root (".artifacts\real\mutantes-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $log -Append | Out-Null
Evitar-Suspension
try {
  Asegurar-Docker
  foreach ($f in $Familias) {
    Paso "Mutantes de $f"
    node runner/real/mutants.mjs $f 2>&1 | Out-Host
  }
  Write-Host "Detalle: .artifacts\real-calibration\resumen.md y docs\verification\real-mutants-*.json   ·   Registro: $log"
}
finally {
  Permitir-Suspension
  Stop-Transcript | Out-Null
}
