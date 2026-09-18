#!/usr/bin/env bash
# Reproduce todas las cifras del articulo: ./download.sh una vez y despues este script.
set -e
cd "$(dirname "$0")"
./build.sh
mkdir -p results
node qrs.mjs
node rate_error.mjs
node synthetic.mjs
node eeg_population.mjs
node figures.mjs "${1:-results/figures}"
# No necesita los registros descargados: mide el arbol de fuentes.
node quality.mjs
