@echo off
rem Doble clic: prepara las imagenes Docker de S011-S020 y despues ensaya el pipeline con las 20 familias.
rem S001-S010 ya tienen imagen; su ensayo se repite porque cambio codigo del pipeline (known_failures por archivo).
rem Tarda varias horas y usa Internet solo al preparar las imagenes. Deja el PC encendido.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preparar-imagenes.ps1" -Familias "S011,S012,S013,S014,S015,S016,S017,S018,S019,S020"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensayar-familias.ps1"
echo.
echo Proceso terminado. Revisa config\real-bases.json y docs\verification\real-rehearsal-*.json
pause
