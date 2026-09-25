# Ejecuta el banco de modelos locales contra la GPU de Vast.ai (vía túnel) y guarda el resumen con commit.
# Requisitos: Docker Desktop abierto, túnel activo (tunnel.ps1 en otra ventana), instancia preparada.
# Uso: .\scripts\vast\bench.ps1 [-Models qwen3coder30-32k,devstral24-32k] [-Tasks V0,V1,V2,V3] [-LocalPort 11435]
param([string[]]$Models, [string[]]$Tasks, [int]$LocalPort = 11435)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
New-Item -ItemType Directory -Force -Path (Join-Path $root '.artifacts') | Out-Null
$log = Join-Path $root (".artifacts\bench-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $log -Append | Out-Null
try {
  $env:EVOGUARD_OLLAMA_PORT = "$LocalPort"
  try { $v = Invoke-RestMethod "http://127.0.0.1:$LocalPort/api/version" -TimeoutSec 10 -ErrorAction Stop; Write-Host "Ollama remoto $($v.version) en 127.0.0.1:$LocalPort" }
  catch { throw "No hay Ollama en 127.0.0.1:$LocalPort. ¿Está abierto tunnel.ps1?" }
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker no está disponible' }
  $benchArgs = @()
  if ($Models) { $benchArgs += "--models=$($Models -join ',')" }
  if ($Tasks) { $benchArgs += "--tasks=$($Tasks -join ',')" }
  npm run bench:local -- @benchArgs
  git add docs/verification/local-bench
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git commit -q -m "bench: local model results on rented GPU`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01HrHhksughx5eshrb2talfk"
    Write-Host "commit $(git rev-parse --short HEAD)"
  }
}
catch { Write-Host "ERROR: $($_.Exception.Message)" }
finally { Stop-Transcript | Out-Null; Write-Host "Log: $log" }
