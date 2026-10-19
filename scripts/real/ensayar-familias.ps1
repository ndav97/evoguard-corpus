# EvoGuard — ensayo del pipeline con cada familia semi-real, SIN modelos (R3/R4).
#
# Con la imagen ya preparada (preparar-imagenes.cmd), un "constructor" guionado aplica los parches de referencia y
# el pipeline completo los evalúa como si fueran de un modelo: contenedores sin red, suite visible, oráculo con los
# tests ocultos, control de alcance e historia reconstruida por hash (V1 → V2 → V3). En V1 prueba además los
# rechazos: borrar un test (alcance), no cambiar nada (oráculo) y código roto (reparación con feedback visible).
# Resultado por familia: docs\verification\real-rehearsal-sxxx.json (lo exige el preflight antes de generar).
#
# Uso (PowerShell o doble clic en ensayar-familias.cmd):
#   .\scripts\real\ensayar-familias.ps1                    # las 40 familias train/val
#   .\scripts\real\ensayar-familias.ps1 -Familias S010,S005
#   .\scripts\real\ensayar-familias.ps1 -Repetir            # repite también las que ya están vigentes
#
# Desde el 2026-10-08:
#   - retoma: se salta los ensayos vigentes (PASS con el código y la imagen actuales; runner/real/rehearsal-status.mjs);
#   - vigila: cada familia tiene un límite de -LimiteMinutos (150); si lo supera se detiene el proceso con sus hijos.
#     Si una familia falla, se reinicia Docker cuando no responde o se superó el límite, se eliminan sus contenedores
#     y se reintenta una vez;
#   - registra la salida de cada ensayo en .artifacts\real\ensayo-<familia>-<fecha>.log.

param([string[]]$Familias = @('S001', 'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008', 'S009', 'S010', 'S011', 'S012', 'S013', 'S014', 'S015', 'S016', 'S017', 'S018', 'S019', 'S020', 'S022', 'S024', 'S029', 'S030', 'S031', 'S032', 'S041', 'S042', 'S045', 'S046', 'S048', 'S050', 'S051', 'S053', 'S054', 'S055', 'S056', 'S057', 'S058', 'S059'), [int]$LimiteMinutos = 150, [switch]$Repetir)

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
  $sello = Get-Date -Format 'yyyyMMdd-HHmmss'
  # Un ensayo con vigilante y, si se cortó o Docker dejó de responder, un reintento tras reiniciar Docker.
  function Ensayar([string]$objetivo, [string]$nombre, [int]$limite) {
    if (-not $Repetir) {
      node runner/real/rehearsal-status.mjs $objetivo | ForEach-Object { Write-Host $_ }
      if ($LASTEXITCODE -eq 0) { Write-Host 'Vigente con el código actual: se salta.' -ForegroundColor Green; return $true }
    }
    for ($intento = 1; $intento -le 2; $intento++) {
      Asegurar-Docker
      Limpiar-Contenedores
      $registro = Join-Path $root ".artifacts\real\ensayo-$nombre-$sello-$intento.log"
      $r = Ejecutar-Vigilado @('runner/real/rehearse.mjs', $objetivo) $registro $limite
      if ($r -eq 'PASS') { return $true }
      $dockerVivo = DockerResponde
      # Un fallo funcional real se repite en el reintento; uno de infraestructura (Docker colgado) no.
      if ($intento -eq 1) {
        Write-Host "${nombre}: $r con Docker $(if ($dockerVivo) { 'respondiendo' } else { 'sin responder' }); se reintenta una vez." -ForegroundColor Yellow
        if (-not $dockerVivo -or $r -eq 'LIMITE') { Reiniciar-Docker }
        continue
      }
      Write-Host "${nombre}: el ensayo no pasó. Salida: $registro" -ForegroundColor Yellow
      return $false
    }
    return $false
  }
  # Ensayo general del pipeline (familia de prueba S900): el preflight lo exige con el código actual.
  Paso 'Ensayo general del pipeline (S900)'
  if (-not (Ensayar '--mini' 'S900' 60)) { $fallidas += 'S900 (ensayo general)' }
  $Familias = $Familias | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
  foreach ($f in $Familias) {
    Paso "Ensayando $f"
    if (-not (Ensayar $f $f $LimiteMinutos)) { $fallidas += $f }
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
