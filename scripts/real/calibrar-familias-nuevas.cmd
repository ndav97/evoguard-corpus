@echo off
rem Doble clic: calibra las familias semi-reales nuevas S011-S020 (anadidas el 2026-10-02).
rem Usa las bases ya instaladas por scripts\mine\verificar-bases (volumen Docker evoguard-bases).
rem Resultados: .artifacts\real-calibration\resumen.md y un Sxxx.json por familia.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0calibrar-familias-reales.ps1" -Familia "S011,S012,S013,S014,S015,S016,S017,S018,S019,S020"
echo.
echo Proceso terminado. Revisa .artifacts\real-calibration\resumen.md
pause
