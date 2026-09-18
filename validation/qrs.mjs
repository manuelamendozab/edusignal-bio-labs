// Deteccion QRS (AAMI EC57) y matriz de confusion de la regla de tres clases.
import { writeFileSync } from "node:fs";
import { applySignalFilter, detectRPeaks } from "./.build/signal-utils.mjs";
import { checksum, readAnnotations, readHeader } from "./lib/wfdb.mjs";
import { loadWfdb, pickChannel } from "./lib/load.mjs";
import { median, MITDB, toSignal } from "./lib/stats.mjs";

const DIR = "data/mitdb", TOL_S = 0.15, SEG_S = 10;
const BRADY = 50, TACHY = 100, MIN_BEATS = 5;
const FILTERS = ["none", "high-pass", "band-pass"];
const LABELS = ["Normal", "Arrhythmia", "Inconclusive"];

function match(refs, dets, tol) {
  const used = new Array(dets.length).fill(false);
  let tp = 0, j = 0;
  for (const ref of refs) {
    while (j < dets.length && dets[j] < ref - tol) j += 1;
    let best = -1, bestD = Infinity;
    for (let k = j; k < dets.length && dets[k] <= ref + tol; k += 1) {
      if (!used[k] && Math.abs(dets[k] - ref) < bestD) { bestD = Math.abs(dets[k] - ref); best = k; }
    }
    if (best >= 0) { used[best] = true; tp += 1; }
  }
  return { tp, fn: refs.length - tp, fp: dets.length - tp };
}
const label = (beats) => (beats < MIN_BEATS ? "Inconclusive" : ((beats / SEG_S) * 60 > TACHY || (beats / SEG_S) * 60 < BRADY ? "Arrhythmia" : "Normal"));
const stats = ({ tp, fp, fn }) => ({ se: (100 * tp) / (tp + fn), pp: (100 * tp) / (tp + fp), f1: (200 * tp) / (2 * tp + fp + fn), der: (100 * (fp + fn)) / (tp + fn) });

const global = Object.fromEntries(FILTERS.map((f) => [f, { tp: 0, fp: 0, fn: 0 }]));
const confusion = Object.fromEntries(LABELS.map((r) => [r, Object.fromEntries(LABELS.map((p) => [p, 0]))]));
const perRecord = [];
let checksumsOk = 0, checksumsTotal = 0;

for (const rec of MITDB) {
  const h = readHeader(DIR, rec);
  const signal = await loadWfdb(DIR, rec);
  const fs = signal.samplingRate;
  const { index: ch, values } = pickChannel(signal, /mlii/i);
  // Verifica el decodificador de produccion contra la suma de control de la cabecera.
  const spec = h.signals[ch];
  checksumsTotal += 1;
  if (checksum(values.map((v) => Math.round(v * spec.gain) + spec.baseline)) === spec.checksum) checksumsOk += 1;
  const refs = readAnnotations(DIR, rec);
  const row = { record: rec };
  for (const f of FILTERS) {
    const peaks = detectRPeaks(applySignalFilter(toSignal(rec, values, fs), f).values, fs);
    const m = match(refs, peaks, Math.round(TOL_S * fs));
    for (const k of ["tp", "fp", "fn"]) global[f][k] += m[k];
    row[f] = stats(m);
    if (f === "high-pass") {
      const n = SEG_S * fs;
      for (let s = 0; s + n <= values.length; s += n) {
        const inWin = (t) => t >= s && t < s + n;
        confusion[label(refs.filter(inWin).length)][label(peaks.filter(inWin).length)] += 1;
      }
    }
  }
  perRecord.push(row);
}

const hp = perRecord.map((r) => r["high-pass"].se);
const out = {
  records: perRecord.length,
  beats: global["high-pass"].tp + global["high-pass"].fn,
  checksums: `${checksumsOk}/${checksumsTotal}`,
  detection: Object.fromEntries(FILTERS.map((f) => [f, { ...global[f], ...stats(global[f]) }])),
  highPassPerRecord: {
    medianSe: median(hp),
    above99: hp.filter((v) => v > 99).length,
    below90: hp.filter((v) => v < 90).length,
    worst: perRecord.map((r) => [r.record, r["high-pass"].se]).sort((a, b) => a[1] - b[1]).slice(0, 4),
  },
  confusion,
};
writeFileSync("results/qrs.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, confusion: undefined }, null, 1));
console.table(confusion);
