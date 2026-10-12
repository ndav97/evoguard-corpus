#!/usr/bin/env bash
# Se ejecuta DENTRO de la instancia de Vast.ai (lo lanza prepare.ps1 por SSH).
# Instala Ollama si falta, lo arranca solo en 127.0.0.1:11434 (accesible únicamente por el túnel SSH) y descarga
# los modelos pedidos. Uso: bash setup-instance.sh modelo1 modelo2 ...
set -euo pipefail
echo "== GPU"; nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader || { echo "Sin GPU NVIDIA visible"; exit 1; }
echo "== Disco"; df -h / | tail -1
# Versión fijada de Ollama (decisión 2026-10-12; la pasa prepare.ps1 desde config/models.json). Toda instancia usa la
# misma versión: si la instalada es otra, se detiene el servidor y se reinstala la fijada.
PIN="${OLLAMA_VERSION:-}"
installed="$(command -v ollama >/dev/null 2>&1 && ollama -v 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | tail -1 || true)"
if [ -z "$installed" ] || { [ -n "$PIN" ] && [ "$installed" != "$PIN" ]; }; then
  echo "== Instalando Ollama ${PIN:-(última)} (instalada: ${installed:-ninguna})"
  command -v curl >/dev/null || (apt-get update -qq && apt-get install -y -qq curl zstd >/dev/null)
  command -v zstd >/dev/null || (apt-get update -qq && apt-get install -y -qq zstd >/dev/null) || true
  pkill -f "ollama serve" 2>/dev/null || true; sleep 2
  curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION="$PIN" sh
fi
if ! curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  echo "== Iniciando Ollama en 127.0.0.1:11434"
  # Sin exposición pública: OLLAMA_HOST solo en loopback. Una petición a la vez para medir tiempos limpios.
  OLLAMA_HOST=127.0.0.1:11434 OLLAMA_KEEP_ALIVE=30m OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_FLASH_ATTENTION=1 \
    nohup ollama serve > /root/ollama.log 2>&1 &
  for i in $(seq 1 60); do curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break; sleep 1; done
fi
running="$(curl -fsS http://127.0.0.1:11434/api/version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)"
echo "== Ollama $running"
if [ -n "$PIN" ] && [ "$running" != "$PIN" ]; then echo "Ollama $running en ejecución, se esperaba $PIN"; exit 1; fi
for model in "$@"; do
  echo "== Descargando $model"
  ollama pull "$model"
done
echo "== Modelos disponibles"
ollama list
# Ficha del entorno (la copia prepare.ps1 a docs/verification/gpu-sessions/): GPU, driver, CUDA, Ollama y digests.
gpu="$(nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader | head -1)"
cuda="$(nvidia-smi | grep -oE 'CUDA Version: [0-9.]+' | grep -oE '[0-9.]+$' || true)"
{
  printf '{"recorded_at":"%s","instance":"%s","gpu":"%s","cuda":"%s","ollama_version":"%s","disk":"%s","models":' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${VAST_CONTAINERLABEL:-$(hostname)}" "$gpu" "$cuda" "$running" "$(df -h / | tail -1 | awk '{print $2}')"
  curl -fsS http://127.0.0.1:11434/api/tags | python3 -c 'import json,sys;print(json.dumps([{"name":m["name"],"digest":m["digest"]} for m in json.load(sys.stdin)["models"]]))' 2>/dev/null || echo '[]'
  echo '}'
} > /root/evoguard-env.json
cat /root/evoguard-env.json
echo "LISTO"
