#!/bin/sh
# Instalación de dependencias de un repositorio real dentro de la imagen de su familia (con red, solo al preparar).
# Busca el lockfile desde el paquete de la app hacia la raíz del repositorio e instala con el gestor que corresponde,
# sin actualizar el lockfile. Deja constancia en /workspace/.evoguard-install.json.
set -eu
PKG="${1:-.}"
cd "/workspace/repo/$PKG"
dir=$(pwd)
LOCKDIR=""; LOCK=""
while :; do
  for f in pnpm-lock.yaml yarn.lock package-lock.json; do
    if [ -f "$dir/$f" ]; then LOCKDIR="$dir"; LOCK="$f"; break 2; fi
  done
  [ "$dir" = "/workspace/repo" ] && break
  dir=$(dirname "$dir")
done
[ -n "$LOCK" ] || { echo "Sin lockfile entre $PKG y la raíz" >&2; exit 1; }
cd "$LOCKDIR"
mkdir -p "$HOME/bin"
export PATH="$HOME/bin:$PATH"
if command -v corepack >/dev/null 2>&1; then corepack enable --install-directory "$HOME/bin" >/dev/null 2>&1 || true; fi
case "$LOCK" in
  pnpm-lock.yaml)
    pnpm install --frozen-lockfile || npx -y pnpm@9 install --frozen-lockfile || npx -y pnpm@8 install --frozen-lockfile ;;
  yarn.lock)
    yarn install --immutable || yarn install --frozen-lockfile || yarn install --frozen-lockfile --ignore-engines ;;
  package-lock.json)
    npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps ;;
esac
SHA=$(sha256sum "$LOCK" | cut -d' ' -f1)
REL=$(echo "$LOCKDIR" | sed 's#^/workspace/repo/\{0,1\}##')
printf '{"lock_dir":"%s","lockfile":"%s","lockfile_sha256":"%s","node":"%s"}\n' "${REL:-.}" "$LOCK" "$SHA" "$(node -v)" > /workspace/.evoguard-install.json
