# EvoGuard — devuelve a Windows el espacio que Docker ya liberó por dentro.
#
# El disco virtual de Docker Desktop (docker_data.vhdx) crece pero no encoge solo: aunque se borren archivos
# dentro de Docker, el archivo .vhdx sigue ocupando lo mismo en C:. Este script:
#   1) marca como libres los bloques borrados (fstrim, con la imagen oficial docker/desktop-reclaim-space);
#   2) apaga Docker Desktop y WSL;
#   3) compacta el .vhdx con diskpart (necesita permisos de administrador; el script los pide);
#   4) intenta activar el modo "sparse" para que en adelante encoja solo;
#   5) muestra el espacio libre de C: antes y después.
# No borra nada de Docker: solo recupera el espacio que ya estaba libre por dentro.

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Pidiendo permisos de administrador (acepta el aviso de Windows)...'
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -NoExit -File `"$PSCommandPath`""
  exit
}

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
. (Join-Path $root 'scripts\real\lib-docker.ps1')
$log = Join-Path $root (".artifacts\compactar-disco-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $log -Append | Out-Null
function LibreC { [math]::Round((Get-PSDrive C).Free / 1GB, 1) }
try {
  Paso "Espacio libre en C: antes: $(LibreC) GB"

  $candidatos = @(
    "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx",
    "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx",
    "$env:LOCALAPPDATA\Docker\wsl\main\ext4.vhdx"
  )
  $vhdx = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $vhdx) {
    $vhdx = Get-ChildItem "$env:LOCALAPPDATA\Docker" -Recurse -Filter *.vhdx -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 1 -ExpandProperty FullName
  }
  if (-not $vhdx) { throw 'No encuentro el disco virtual de Docker (.vhdx). Revisa en Docker Desktop > Settings > Resources > Advanced > Disk image location y dímelo.' }
  Write-Host "Disco de Docker: $vhdx ($([math]::Round((Get-Item $vhdx).Length / 1GB, 1)) GB)"

  Paso 'Marcando como libre el espacio borrado dentro de Docker (fstrim)'
  Asegurar-Docker
  docker run --rm --privileged --pid=host docker/desktop-reclaim-space 2>&1 | Out-Host

  Paso 'Apagando Docker Desktop y WSL'
  Get-Process 'Docker Desktop', 'com.docker.backend', 'com.docker.build', 'com.docker.service' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  wsl --shutdown 2>&1 | Out-Null
  Start-Sleep 10

  Paso 'Compactando el disco virtual (puede tardar 10-40 minutos)'
  $dp = Join-Path $env:TEMP 'evoguard-compact.txt'
  @("select vdisk file=`"$vhdx`"", 'attach vdisk readonly', 'compact vdisk', 'detach vdisk') | Set-Content -Encoding ASCII $dp
  diskpart /s $dp | Out-Host
  Remove-Item $dp -ErrorAction SilentlyContinue
  Write-Host "Disco de Docker ahora: $([math]::Round((Get-Item $vhdx).Length / 1GB, 1)) GB"

  Paso 'Activando el modo sparse (para que en adelante encoja solo)'
  foreach ($d in 'docker-desktop', 'docker-desktop-data') { wsl --manage $d --set-sparse true 2>&1 | Out-Host }

  Paso "Espacio libre en C: después: $(LibreC) GB"
  Write-Host 'Puedes volver a abrir Docker Desktop. Luego lanza scripts\mine\verificar-bases-ronda3.cmd.' -ForegroundColor Green
  Write-Host "Registro: $log"
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registro completo: $log"
}
finally { Stop-Transcript | Out-Null }
