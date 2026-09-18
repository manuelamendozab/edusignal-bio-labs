# Validación de EduSignal

Reproduce todas las cifras del artículo ejecutando el código de producción
(`frontend/src/components/LaboratorioVirtual/signal-utils.ts`) sin modificarlo.

```bash
./download.sh   # una vez: MIT-BIH (44 registros), emg_healthy y EEG R01/R02 de 109 sujetos (~370 MB)
./run_all.sh    # transpila el código y genera results/*.json
```

| Script | Resultado |
|---|---|
| `qrs.mjs` | Detección QRS (AAMI EC57, ±150 ms), checksums del lector WFDB y matriz de confusión de la regla |
| `rate_error.mjs` | Error de BPM y RR medio frente a las anotaciones, por ventanas de 10 s |
| `synthetic.mjs` | Welch y segmentación EMG contra verdad-terreno sintética |
| `eeg_population.mjs` | Efecto Berger en los 109 sujetos (canal Oz), sin filtro y con pasa-altos |
| `figures.mjs` | Datos de las figuras del artículo |
| `quality.mjs` | Tabla IV: LOC, tests, cobertura, dependencias y hallazgos de ESLint |

`quality.mjs` es el único que no necesita `download.sh`: mide el árbol de fuentes,
no los registros.

`data/`, `.build/` y `results/` no se versionan.
