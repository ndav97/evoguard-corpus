# EvoGuard — ensayo del ejecutor de episodios, SIN modelos (agente guionado con los parches de referencia).
# Tres escenarios con resultado conocido (ideal, turno sin entrega, regresión provocada) con el oráculo real.
# Resultado: docs\verification\episode-rehearsal.json (lo exige el ejecutor antes de medir con modelos).
# Uso: .\scripts\episode\ensayar-episodios.ps1 [-Familia S001]
param([string]$Familia = 'S001', [int]$LimiteMinutos = 120)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
. (Join-Path $root 'scripts\real\lib-docker.ps1')
New-Item -ItemType Directory -Force -Path (Join-Path $root '.artifacts\episodes') | Out-Null
$sello = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $root ".artifacts\episodes\ensayo-$sello.log"
Start-Transcript -Path $log -Append | Out-Null
Evitar-Suspension
try {
  Paso 'Comprobando Docker'
  Asegurar-Docker
  Fijar-Memoria
  Limpiar-Contenedores
  Paso "Ensayo del ejecutor de episodios con $Familia"
  $res = Ejecutar-Vigilado @('runner/episode/rehearse.mjs', $Familia) (Join-Path $root ".artifacts\episodes\ensayo-$Familia-$sello.out.log") $LimiteMinutos
  if ($res -eq 'PASS') { Write-Host 'Ensayo del ejecutor de episodios: PASS' -ForegroundColor Green }
  else { Write-Host "Ensayo del ejecutor de episodios: $res (ver el registro)" -ForegroundColor Yellow }
}
catch { Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red }
finally {
  Permitir-Suspension
  Stop-Transcript | Out-Null
  Write-Host "Registro: $log"
}
