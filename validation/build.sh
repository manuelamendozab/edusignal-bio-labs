#!/usr/bin/env bash
# Transpila el codigo de produccion sin modificarlo, para que la validacion lo ejecute tal cual.
set -e
cd "$(dirname "$0")/../frontend"
npx esbuild src/components/LaboratorioVirtual/signal-utils.ts --format=esm --platform=node \
  --outfile=../validation/.build/signal-utils.mjs --log-level=error
echo "signal-utils transpilado"
