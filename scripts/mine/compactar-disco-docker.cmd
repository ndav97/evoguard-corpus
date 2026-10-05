@echo off
rem Doble clic: devuelve a Windows el espacio que Docker ya libero por dentro (compacta su disco virtual). Pide permisos de administrador.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0compactar-disco-docker.ps1"
