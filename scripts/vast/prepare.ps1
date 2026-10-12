# Prepara una instancia de Vast.ai para el banco de modelos locales.
# Uso: .\scripts\vast\prepare.ps1 -SshHost 1.2.3.4 -SshPort 41234 [-Models qwen3-coder:30b,devstral:24b]
# Copia setup-instance.sh a la instancia y lo ejecuta (instala/arranca Ollama y descarga modelos).
param(
  [Parameter(Mandatory = $true)][string]$SshHost,
  [Parameter(Mandatory = $true)][int]$SshPort,
  [string[]]$Models,
  [string]$Key = "$HOME\.ssh\id_ed25519"
)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $Models) {
  $config = Get-Content (Join-Path $root 'config\local-bench.json') -Raw | ConvertFrom-Json
  $Models = $config.candidates.model | Select-Object -Unique
}
$ollamaVersion = ((Get-Content (Join-Path $root 'config\models.json') -Raw | ConvertFrom-Json).models.PSObject.Properties.Value | Where-Object { $_.ollama_version } | Select-Object -First 1).ollama_version
Write-Host "Modelos: $($Models -join ', ')  ·  Ollama fijado: $ollamaVersion"
$sshOpts = @('-i', $Key, '-p', "$SshPort", '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ServerAliveInterval=30')
scp -i $Key -P $SshPort -o StrictHostKeyChecking=accept-new (Join-Path $PSScriptRoot 'setup-instance.sh') "root@${SshHost}:/root/setup-instance.sh"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar setup-instance.sh (revisa host, puerto y clave SSH)' }
ssh @sshOpts "root@$SshHost" "OLLAMA_VERSION=$ollamaVersion bash /root/setup-instance.sh $($Models -join ' ')"
if ($LASTEXITCODE -ne 0) { throw 'La preparación de la instancia falló' }
# Ficha del entorno al repo (evidencia de GPU, driver, CUDA, versión de Ollama y digests de esta sesión).
$sessions = Join-Path $root 'docs\verification\gpu-sessions'
New-Item -ItemType Directory -Force -Path $sessions | Out-Null
$envFile = Join-Path $sessions ((Get-Date -Format 'yyyyMMdd-HHmmss') + "-$($SshHost -replace '[^0-9A-Za-z]','-').json")
scp -i $Key -P $SshPort -o StrictHostKeyChecking=accept-new "root@${SshHost}:/root/evoguard-env.json" $envFile
if ($LASTEXITCODE -eq 0) { Write-Host "Entorno registrado: $envFile" } else { Write-Host 'AVISO: no se pudo copiar la ficha del entorno' }
Write-Host "Instancia lista. Siguiente paso: .\scripts\vast\tunnel.ps1 -SshHost $SshHost -SshPort $SshPort"
