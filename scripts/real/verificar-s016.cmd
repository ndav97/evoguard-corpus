@echo off
rem Doble clic: recalibra S016 (referencia de T002 corregida el 2026-10-04), repite sus mutantes y su ensayo del pipeline.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0recalibrar-reforzadas.ps1" -Familias S016
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensayar-familias.ps1" -Familias S016
echo.
echo Proceso terminado. Revisa .artifacts\real-calibration\resumen.md y docs\verification\real-rehearsal-s016.json
pause
