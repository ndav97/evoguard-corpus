@echo off
rem Doble clic: calibra la primera tanda del corpus definitivo (S021-S030, 5 turnos por familia).
rem Usa las bases instaladas por scripts\mine\verificar-bases-ronda2/3 (volumen evoguard-bases).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0calibrar-familias-reales.ps1" -Familia "S021,S022,S023,S024,S025,S026,S027,S028,S029,S030"
echo.
echo Proceso terminado. Revisa .artifacts\real-calibration\resumen.md
pause
