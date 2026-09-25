# EvoGuard F001 — ejecución completa en el equipo del usuario (Pasos 7–8).
# Verifica el entorno, ensaya el pipeline, genera V0→V3 con los modelos reales, audita y congela.
# Log: .artifacts\run-f001-<fecha>.log (fuera de Git). Cada etapa termina con commit.
# Continue: los programas nativos escriben en stderr sin fallar; el éxito se decide por $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force -Path (Join-Path $root '.artifacts') | Out-Null
$log = Join-Path $root (".artifacts\run-f001-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $log -Append | Out-Null
$trailer = "`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01HrHhksughx5eshrb2talfk"

function Step($name) { Write-Host "`n=== $name ($(Get-Date -Format s)) ===" }
function Run($label, [scriptblock]$block) {
  & $block
  if ($LASTEXITCODE -ne 0) { throw "$label terminó con código $LASTEXITCODE" }
}
function CommitIfChanged($message) {
  git add -A -- config docs families runs evaluator 2>$null
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) { git commit -q -m ($message + $trailer); Write-Host "commit $(git rev-parse --short HEAD)" }
}

try {
  Step 'Docker'
  docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    if (Test-Path $desktop) { Start-Process $desktop }
    for ($i = 0; $i -lt 60; $i++) { Start-Sleep 5; docker info *> $null; if ($LASTEXITCODE -eq 0) { break } }
    if ($LASTEXITCODE -ne 0) { throw 'Docker no está disponible' }
  }
  Write-Host 'Docker OK'

  Step 'Ollama'
  try { Invoke-RestMethod http://127.0.0.1:11434/api/tags -TimeoutSec 5 -ErrorAction Stop | Out-Null }
  catch {
    Start-Process ollama -ArgumentList 'serve' -WindowStyle Hidden
    Start-Sleep 10
    Invoke-RestMethod http://127.0.0.1:11434/api/tags -TimeoutSec 10 -ErrorAction Stop | Out-Null
  }
  Write-Host 'Ollama OK'

  Step 'Verificación del contenedor'
  Run 'environment:verify' { npm run environment:verify }
  Step 'Ensayo integral del pipeline'
  Run 'pipeline:rehearse' { npm run pipeline:rehearse }
  CommitIfChanged 'chore: native container verification and pipeline rehearsal evidence'
  Step 'Preflight'
  Run 'generation:preflight' { npm run generation:preflight }

  Step 'Generación V0-V3 con modelos reales'
  Run 'corpus:generate' { npm run corpus:generate -- all }

  Step 'Auditoría y congelamiento'
  Run 'corpus:audit' { npm run corpus:audit -- --freeze }
  CommitIfChanged 'corpus: F001 audited and frozen'
  Step 'F001 COMPLETA'
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)"
  CommitIfChanged 'corpus: F001 partial run records (stopped)'
  Write-Host 'EJECUCION DETENIDA'
}
finally { Stop-Transcript | Out-Null }
