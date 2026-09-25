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
Write-Host "Modelos: $($Models -join ', ')"
$sshOpts = @('-i', $Key, '-p', "$SshPort", '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ServerAliveInterval=30')
scp -i $Key -P $SshPort -o StrictHostKeyChecking=accept-new (Join-Path $PSScriptRoot 'setup-instance.sh') "root@${SshHost}:/root/setup-instance.sh"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar setup-instance.sh (revisa host, puerto y clave SSH)' }
ssh @sshOpts "root@$SshHost" "bash /root/setup-instance.sh $($Models -join ' ')"
if ($LASTEXITCODE -ne 0) { throw 'La preparación de la instancia falló' }
Write-Host "Instancia lista. Siguiente paso: .\scripts\vast\tunnel.ps1 -SshHost $SshHost -SshPort $SshPort"
