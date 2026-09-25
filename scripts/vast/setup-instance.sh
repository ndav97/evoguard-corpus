#!/usr/bin/env bash
# Se ejecuta DENTRO de la instancia de Vast.ai (lo lanza prepare.ps1 por SSH).
# Instala Ollama si falta, lo arranca solo en 127.0.0.1:11434 (accesible únicamente por el túnel SSH) y descarga
# los modelos pedidos. Uso: bash setup-instance.sh modelo1 modelo2 ...
set -euo pipefail
echo "== GPU"; nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader || { echo "Sin GPU NVIDIA visible"; exit 1; }
echo "== Disco"; df -h / | tail -1
if ! command -v ollama >/dev/null 2>&1; then
  echo "== Instalando Ollama"
  command -v curl >/dev/null || (apt-get update -qq && apt-get install -y -qq curl zstd >/dev/null)
  command -v zstd >/dev/null || (apt-get update -qq && apt-get install -y -qq zstd >/dev/null) || true
  curl -fsSL https://ollama.com/install.sh | sh
fi
if ! curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  echo "== Iniciando Ollama en 127.0.0.1:11434"
  # Sin exposición pública: OLLAMA_HOST solo en loopback. Una petición a la vez para medir tiempos limpios.
  OLLAMA_HOST=127.0.0.1:11434 OLLAMA_KEEP_ALIVE=30m OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_FLASH_ATTENTION=1 \
    nohup ollama serve > /root/ollama.log 2>&1 &
  for i in $(seq 1 60); do curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break; sleep 1; done
fi
echo "== Ollama $(curl -fsS http://127.0.0.1:11434/api/version)"
for model in "$@"; do
  echo "== Descargando $model"
  ollama pull "$model"
done
echo "== Modelos disponibles"
ollama list
echo "LISTO"
