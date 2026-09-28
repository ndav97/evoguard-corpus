@echo off
rem Doble clic: ensaya el pipeline (sin modelos) con cada familia semi-real ya preparada.
rem Solo algunas, desde una terminal: scripts\real\ensayar-familias.cmd -Familias S010,S005
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensayar-familias.ps1" %*
echo.
echo Proceso terminado. Revisa docs\verification\real-rehearsal-*.json
pause
