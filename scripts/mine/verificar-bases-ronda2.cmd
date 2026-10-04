@echo off
rem Doble clic: verifica las 55 bases de la ronda 2 de mineria (instala con red y ejecuta sus suites dos veces sin red).
rem Resultados en .artifacts\baselines-ronda2. Tarda varias horas; si se interrumpe, vuelve a lanzarlo y continua.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verificar-bases.ps1" -Cantidad 55 -Lista scripts/mine/repos-v0-ronda2.txt -Salida .artifacts/baselines-ronda2
echo.
echo Proceso terminado. Revisa .artifacts\baselines-ronda2\baselines.csv
pause
