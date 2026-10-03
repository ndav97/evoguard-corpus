@echo off
rem Doble clic: ejecuta scripts\run-f001.ps1 (EvoGuard F001 completo).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-f001.ps1"
echo.
echo Proceso terminado. Revisa .artifacts\run-f001-*.log
pause
