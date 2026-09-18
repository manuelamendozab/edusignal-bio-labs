#!/usr/bin/env bash
# Descarga los registros PhysioNet usados en la validacion del articulo.
set -u
cd "$(dirname "$0")/data"
get(){ [ -s "$2" ] || curl -sfL --retry 3 -o "$2" "$1" || echo "FALLO $1"; }

# MIT-BIH: los 44 registros no marcapasados (AAMI EC57 excluye 102, 104, 107, 217).
for r in 100 101 103 105 106 108 109 111 112 113 114 115 116 117 118 119 121 122 123 124 \
         200 201 202 203 205 207 208 209 210 212 213 214 215 219 220 221 222 223 228 230 231 232 233 234; do
  for e in hea dat atr; do get "https://physionet.org/files/mitdb/1.0.0/$r.$e" "mitdb/$r.$e"; done
done
echo "MIT-BIH OK"

# EMG: registro sano del tibial anterior.
for e in hea dat; do get "https://physionet.org/files/emgdb/1.0.0/emg_healthy.$e" "emgdb/emg_healthy.$e"; done
echo "EMG OK"

# EEG Motor Movement/Imagery: basales con ojos abiertos (R01) y cerrados (R02) de los 109 sujetos.
for i in $(seq -f "%03g" 1 109); do
  for run in R01 R02; do
    get "https://physionet.org/files/eegmmidb/1.0.0/S$i/S$i$run.edf" "eegmmidb/S$i$run.edf"
  done
done
echo "EEG OK"
echo "DESCARGA COMPLETA"
