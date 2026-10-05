@echo off
rem Doble clic: verifica las 59 bases de la ronda 3 de mineria (instala con red y ejecuta sus suites dos veces sin red).
rem Resultados en .artifacts\baselines-ronda3. Tarda varias horas; si se interrumpe, vuelve a lanzarlo y continua.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verificar-bases.ps1" -Cantidad 59 -Lista scripts/mine/repos-v0-ronda3.txt -Salida .artifacts/baselines-ronda3
echo.
echo Proceso terminado. Revisa .artifacts\baselines-ronda3\baselines.csv
pause
