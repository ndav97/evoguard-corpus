@echo off
rem Doble clic: prueba Grok por Synterolink (10 llamadas del protocolo, sin ejecutar acciones). Informe en .artifacts\providers\
rem Otro modelo: probar-grok-synterolink.cmd grok-4.3
cd /d "%~dp0..\.."
node --env-file=.env scripts\providers\synterolink-grok-check.mjs %*
echo.
pause
