@echo off
rem Doble clic: repite el ensayo de S015 y ejecuta mutantes (S011-S020) y contexto (S001-S020). Sin modelos.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0mutantes-y-contexto.ps1" %*
echo.
echo Proceso terminado. Revisa docs\verification\real-mutants-*.json y real-context.json
pause
