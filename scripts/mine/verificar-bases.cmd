@echo off
rem Doble clic: verifica las 5 primeras bases V0 (piloto).
rem Para mas bases, desde una terminal: scripts\mine\verificar-bases.cmd -Cantidad 46
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verificar-bases.ps1" %*
echo.
echo Proceso terminado. Revisa .artifacts\baselines\
pause
