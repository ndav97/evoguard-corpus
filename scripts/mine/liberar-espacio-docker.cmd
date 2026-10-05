@echo off
rem Doble clic: reinicia Docker y libera espacio del volumen evoguard-bases (bases descartadas y caches de descarga).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0liberar-espacio-docker.ps1"
echo.
pause
