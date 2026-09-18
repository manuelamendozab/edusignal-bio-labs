// Error de estimacion de BPM y del intervalo RR medio frente a las anotaciones MIT-BIH.
import { writeFileSync } from "node:fs";
import { applySignalFilter, computeMetrics, detectRPeaks } from "./.build/signal-utils.mjs";
import { readAnnotations } from "./lib/wfdb.mjs";
import { loadWfdb, pickChannel } from "./lib/load.mjs";
import { mean, median, MITDB, quantile, toSignal } from "./lib/stats.mjs";

const DIR = "data/mitdb", SEG_S = 10, MIN_BEATS = 5;
const bpmAbs = [], bpmSig = [], rrAbs = [], rrSig = [], recAbs = [];
let windows = 0, evaluated = 0;

for (const rec of MITDB) {
  const signal = await loadWfdb(DIR, rec);
  const fs = signal.samplingRate;
  const { values } = pickChannel(signal, /mlii/i);
  const refs = readAnnotations(DIR, rec);
  const peaks = detectRPeaks(applySignalFilter(toSignal(rec, values, fs), "high-pass").values, fs);
  const n = SEG_S * fs;
  const windowSignal = toSignal(rec, new Array(n).fill(0), fs);

  for (let s = 0; s + n <= values.length; s += n) {
    windows += 1;
    const r = refs.filter((t) => t >= s && t < s + n).map((t) => t - s);
    const d = peaks.filter((t) => t >= s && t < s + n).map((t) => t - s);
    // Ventanas en las que la regla emitiria una frecuencia con ambos conjuntos de latidos.
    if (r.length < MIN_BEATS || d.length < MIN_BEATS) continue;
    evaluated += 1;
    const mr = computeMetrics(windowSignal, r);
    const md = computeMetrics(windowSignal, d);
    bpmAbs.push(Math.abs(md.bpm - mr.bpm)); bpmSig.push(md.bpm - mr.bpm);
    rrAbs.push(Math.abs(md.rrMeanMs - mr.rrMeanMs)); rrSig.push(md.rrMeanMs - mr.rrMeanMs);
  }
  recAbs.push(Math.abs(((peaks.length - refs.length) / (values.length / fs)) * 60));
}

const share = (a, x) => (100 * a.filter((e) => e <= x).length) / a.length;
const out = {
  windows, evaluated, excluded: windows - evaluated,
  bpm: { mae: mean(bpmAbs), median: median(bpmAbs), bias: mean(bpmSig), p90: quantile(bpmAbs, 0.9), within1: share(bpmAbs, 1), within5: share(bpmAbs, 5) },
  rr: { mae: mean(rrAbs), median: median(rrAbs), bias: mean(rrSig), p90: quantile(rrAbs, 0.9), within20: share(rrAbs, 20) },
  recordBpm: { mae: mean(recAbs), median: median(recAbs) },
};
writeFileSync("results/rate_error.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
