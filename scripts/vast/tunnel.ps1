# Abre el túnel SSH: Ollama remoto (127.0.0.1:11434 en la instancia) aparece en 127.0.0.1:11435 de este equipo.
# Se usa 11435 para no chocar con tu Ollama local. Deja esta ventana abierta mientras corre el banco o la generación.
# Uso: .\scripts\vast\tunnel.ps1 -SshHost 1.2.3.4 -SshPort 41234
param(
  [Parameter(Mandatory = $true)][string]$SshHost,
  [Parameter(Mandatory = $true)][int]$SshPort,
  [int]$LocalPort = 11435,
  [string]$Key = "$HOME\.ssh\id_ed25519"
)
Write-Host "Túnel 127.0.0.1:$LocalPort -> ${SshHost}:11434 (Ctrl+C para cerrar)"
while ($true) {
  ssh -i $Key -p $SshPort -N -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ServerAliveCountMax=4 -o ExitOnForwardFailure=yes `
    -L "127.0.0.1:${LocalPort}:127.0.0.1:11434" "root@$SshHost"
  Write-Host "Túnel cerrado ($(Get-Date -Format s)); reconectando en 5 s..."
  Start-Sleep 5
}
