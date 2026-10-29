@echo off
rem Doble clic: prueba Gemini por Synterolink (10 llamadas del protocolo, sin ejecutar acciones). Informe en .artifacts\providers\
cd /d "%~dp0..\.."
node --env-file=.env scripts\providers\synterolink-gemini-check.mjs %*
echo.
pause
