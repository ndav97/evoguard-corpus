# EvoGuard — línea base por episodios (brazo B), CON modelos. Métricas de EvoGenUI-Bench por modelo.
#
# Cada episodio es una familia recorrida por UN modelo, turno a turno, sobre su propia salida; el oráculo mide
# cada turno y nunca se muestra al modelo (docs\diseno-linea-base-episodios.md, config\experiment.json).
# Requisitos: ensayos de familias vigentes (scripts\real\ensayar-familias.cmd), ensayo del ejecutor de episodios
# (scripts\episode\ensayar-episodios.cmd), .env con SYNTEROLINK_API_KEY y, para local_a/local_b, el túnel de
# Vast.ai abierto (docs\gpu-vast-ai.md).
#
# Uso (PowerShell o doble clic en linea-base-piloto.cmd):
#   .\scripts\episode\linea-base.ps1                                        # piloto completo (200 episodios)
#   .\scripts\episode\linea-base.ps1 -Proveedores openai,anthropic,google   # solo comerciales (sin GPU)
#   .\scripts\episode\linea-base.ps1 -Proveedores local_a,local_b           # solo locales (túnel abierto)
#   .\scripts\episode\linea-base.ps1 -Familias S001,S002
# Retoma sola: los episodios completos se saltan. Cada episodio tiene un límite de -LimiteMinutos (por defecto,
# 100 minutos por turno de la fase: 300 en el piloto, 500 en la final); si lo supera o falla, se reinicia Docker si
# no responde y se reintenta una vez. Si el ejecutor no llega a iniciar el episodio (preflight, configuración,
# credenciales), se detiene todo con el motivo.

param([string]$Fase = 'pilot', [string[]]$Proveedores = @(), [string[]]$Familias = @(), [int]$LimiteMinutos = 0)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
. (Join-Path $root 'scripts\real\lib-docker.ps1')
New-Item -ItemType Directory -Force -Path (Join-Path $root '.artifacts\episodes') | Out-Null
$sello = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $root ".artifacts\episodes\linea-base-$sello.log"
Start-Transcript -Path $log -Append | Out-Null
Evitar-Suspension
$fallidos = @()
try {
  Paso 'Comprobando Docker'
  Asegurar-Docker
  Fijar-Memoria
  $filtros = @('--phase', $Fase)
  $Proveedores = @($Proveedores | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
  $Familias = @($Familias | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
  if ($Proveedores.Count) { $filtros += @('--providers', ($Proveedores -join ',')) }
  if ($Familias.Count) { $filtros += @('--families', ($Familias -join ',')) }
  $config = Get-Content (Join-Path $root 'config\experiment.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $faseConfig = $config.phases.$Fase
  if (-not $faseConfig) { throw "Fase desconocida: $Fase" }
  if ($LimiteMinutos -le 0) { $LimiteMinutos = 100 * [int]$faseConfig.turns }
  $errPlan = Join-Path $root ".artifacts\episodes\plan-$sello.err"
  $plan = @(node runner/episode/run.mjs plan @filtros 2>$errPlan | Where-Object { $_ -match '^S\d{3} ' })
  if ($LASTEXITCODE -ne 0) { throw "No se pudo calcular el plan:`n$((Get-Content $errPlan -Encoding UTF8) -join "`n")" }
  Write-Host "Episodios pendientes: $($plan.Count) · límite por episodio: $LimiteMinutos min"
  $i = 0
  foreach ($linea in $plan) {
    $i++
    $f, $p, $r, $e = $linea -split ' '
    Paso "Episodio $i de $($plan.Count): $f · $p · repetición $r"
    $ok = $false
    for ($intento = 1; $intento -le 2; $intento++) {
      Asegurar-Docker
      Limpiar-Contenedores
      $registro = Join-Path $root ".artifacts\episodes\episodio-$f-$p-r$r-e$e-$sello-$intento.log"
      $res = Ejecutar-Vigilado @('--env-file-if-exists=.env', 'runner/episode/run.mjs', 'run', '--phase', $Fase, '--family', $f, '--provider', $p, '--repetition', $r, '--episode', $e) $registro $LimiteMinutos
      if ($res -eq 'PASS') { $ok = $true; break }
      $err = (Get-Content "$registro.err" -Encoding UTF8 -ErrorAction SilentlyContinue) -join "`n"
      if ($err -match 'EPISODIO NO INICIADO') { throw "El ejecutor se detuvo antes de empezar:`n$err" }
      if ($intento -eq 1) {
        $dockerVivo = DockerResponde
        Write-Host "${f} ${p}: $res con Docker $(if ($dockerVivo) { 'respondiendo' } else { 'sin responder' }); se reintenta una vez." -ForegroundColor Yellow
        if (-not $dockerVivo -or $res -eq 'LIMITE') { Reiniciar-Docker }
      }
    }
    if (-not $ok) { $fallidos += "$f $p r$r"; Write-Host "${f} ${p}: no se completó (ver $registro)." -ForegroundColor Yellow }
  }
  Paso 'Análisis'
  $experimento = $faseConfig.experiment
  node runner/episode/analyze.mjs --experiment $experimento
  if ($LASTEXITCODE -ne 0) { Write-Host 'El análisis no se pudo generar (¿aún no hay episodios completos?).' -ForegroundColor Yellow }
  Paso 'Resumen'
  if ($fallidos.Count) { Write-Host "Sin completar: $($fallidos -join ', '). Vuelve a ejecutar para reintentarlos." -ForegroundColor Yellow } else { Write-Host 'Todos los episodios del plan están completos.' -ForegroundColor Green }
  Write-Host "Resultados: runs\episodes\$experimento\analisis\resumen.md   ·   Registro: $log"
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registro completo: $log"
}
finally {
  Permitir-Suspension
  Stop-Transcript | Out-Null
}
