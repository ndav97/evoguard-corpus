@echo off
rem Doble clic: recalibra S012, S016 y S018 (tests ocultos reforzados el 2026-10-04) y repite sus mutantes.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0recalibrar-reforzadas.ps1" %*
echo.
echo Proceso terminado. Revisa .artifacts\real-calibration\resumen.md
pause
