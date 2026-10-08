@echo off
rem Doble clic: ensaya el ejecutor de episodios con S001 (sin modelos, unos 20 minutos).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensayar-episodios.ps1" %*
echo.
echo Proceso terminado. Revisa docs\verification\episode-rehearsal.json
pause
