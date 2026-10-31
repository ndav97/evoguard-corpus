@echo off
rem Doble clic: tanda 2 de pi0 (brazo B) con los modelos abiertos en la GPU de Vast.ai: Gemma 4, Qwen3-Coder, Devstral, Qwen3.8 y GLM-4.7-Flash (los episodios completos se saltan).
rem Requisitos: instancia preparada con scripts\vast\prepare.ps1 y el tunel abierto en otra ventana (scripts\vast\tunnel.ps1).
rem Retoma sola: los episodios completos se saltan. Solo un modelo: etiquetas-pi0-locales.cmd -Proveedores local_a
set EVOGUARD_OLLAMA_PORT=11435
echo Comprobando el tunel en 127.0.0.1:%EVOGUARD_OLLAMA_PORT% ...
curl -fsS http://127.0.0.1:%EVOGUARD_OLLAMA_PORT%/api/version
if errorlevel 1 (
  echo.
  echo No responde Ollama por el tunel. Abre scripts\vast\tunnel.ps1 en otra ventana y vuelve a intentarlo.
  pause
  exit /b 1
)
echo.
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0linea-base.ps1" -Fase pi0 -Proveedores google,local_a,local_b,local_c,local_d
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0linea-base.ps1" -Fase pi0 %*
)
echo.
echo Proceso terminado. Resultados en runs\episodes\etiquetas-pi0\analisis\resumen.md
pause
