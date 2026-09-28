@echo off
rem Doble clic: calibra las familias semi-reales (families-real\Sxxx-*).
rem Solo una familia, desde una terminal: scripts\real\calibrar-familias-reales.cmd -Familia S001
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0calibrar-familias-reales.ps1" %*
echo.
echo Proceso terminado. Revisa .artifacts\real-calibration\
pause
