@echo off
rem Doble clic: linea base del piloto por episodios (brazo B, cinco modelos, 200 episodios). Retoma sola.
rem Solo algunos modelos, desde una terminal: scripts\episode\linea-base-piloto.cmd -Proveedores openai,anthropic,google
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0linea-base.ps1" -Fase pilot %*
echo.
echo Proceso terminado. Resultados en runs\episodes\linea-base-piloto\analisis\resumen.md
pause
