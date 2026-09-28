@echo off
rem Doble clic: prepara las imagenes Docker de las familias semi-reales (S001-S010).
rem Solo algunas, desde una terminal: scripts\real\preparar-imagenes.cmd -Familias S010,S005
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preparar-imagenes.ps1" %*
echo.
echo Proceso terminado. Revisa config\real-bases.json
pause
