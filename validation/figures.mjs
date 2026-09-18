// Datos de las figuras de resultados, generados con el codigo de produccion.
import { mkdirSync, writeFileSync } from "node:fs";
import { applySignalFilter, computeEmgFeatures, computeMetrics, computeRmsEnvelope, computeSpectralAnalysis, detectContractions, detectRPeaks } from "./.build/signal-utils.mjs";
import { readAnnotations } from "./lib/wfdb.mjs";
import { loadEdf, loadWfdb, pickChannel } from "./lib/load.mjs";
import { toSignal } from "./lib/stats.mjs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const tab = (cols, rows) => [cols.join(" "), ...rows.map((r) => r.join(" "))].join("\n") + "\n";
const out = {};

// ECG: registro 100, 0-8 s, con deriva y 60 Hz anadidos.
{
  const ecg = await loadWfdb("data/mitdb", "100");
  const fs = ecg.samplingRate;
  const { values } = pickChannel(ecg, /mlii/i);
  const raw = values.slice(0, 8 * fs).map((v, i) => v + 0.45 * Math.sin((2 * Math.PI * 0.15 * i) / fs) + 0.08 * Math.sin((2 * Math.PI * 60 * i) / fs));
  const filt = applySignalFilter(applySignalFilter(toSignal("100", raw, fs), "band-pass"), "notch");
  const peaks = detectRPeaks(filt.values, fs);
  const m = computeMetrics(filt, peaks);
  writeFileSync(`${OUT}/ecg_raw.dat`, tab(["t", "y"], raw.map((v, i) => [(i / fs).toFixed(5), v.toFixed(5)])));
  writeFileSync(`${OUT}/ecg_filt.dat`, tab(["t", "y"], filt.values.map((v, i) => [(i / fs).toFixed(5), v.toFixed(5)])));
  writeFileSync(`${OUT}/ecg_peaks.dat`, tab(["t", "y"], peaks.map((p) => [(p / fs).toFixed(5), filt.values[p].toFixed(5)])));
  out.ecg = { detected: peaks.length, annotated: readAnnotations("data/mitdb", "100").filter((t) => t < 8 * fs).length, bpm: m.bpm, rrMeanMs: m.rrMeanMs };
}

// EEG: sujeto S001, basal con ojos cerrados, canal Oz.
{
  const eeg = await loadEdf("data/eegmmidb/S001R02.edf");
  const fs = eeg.samplingRate;
  const { values } = pickChannel(eeg, /^Oz$/i);
  const r = computeSpectralAnalysis(toSignal("Oz", values, fs));
  const total = Object.values(r.bandPowers).reduce((a, b) => a + b, 0);
  const lim = r.frequencies.findIndex((f) => f > 50);
  writeFileSync(`${OUT}/eeg_psd.dat`, tab(["f", "p"], r.frequencies.slice(0, lim).map((f, i) => [f.toFixed(4), r.powerSpectrum[i].toFixed(6)])));
  const order = ["delta", "theta", "alpha", "beta", "gamma"];
  writeFileSync(`${OUT}/eeg_bands.dat`, tab(["i", "rel"], order.map((b, i) => [i, ((100 * r.bandPowers[b]) / total).toFixed(2)])));
  out.eeg = { fdom: r.dominantFrequency, segments: r.segmentCount, seconds: values.length / fs,
              rel: Object.fromEntries(order.map((b) => [b, (100 * r.bandPowers[b]) / total])) };
}

// EMG: registro sano del tibial anterior.
{
  const emg = await loadWfdb("data/emgdb", "emg_healthy");
  const fs = emg.samplingRate;
  const values = emg.values;
  const rect = values.map(Math.abs);
  const env = computeRmsEnvelope(rect, fs);
  const det = detectContractions(env, fs);
  const B = 8;
  const rows = [];
  for (let i = 0; i < env.length; i += B) rows.push([(i / fs).toFixed(4), env[i].toFixed(5)]);
  writeFileSync(`${OUT}/emg_env.dat`, tab(["t", "y"], rows));
  writeFileSync(`${OUT}/emg_seg.dat`, tab(["a", "b"], det.map((c) => [(c.onset / fs).toFixed(4), (c.offset / fs).toFixed(4)])));
  const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const m = med(env), mad = med(env.map((v) => Math.abs(v - m)));
  // Los descriptores salen del nucleo de procesamiento, no de una copia local:
  // asi la figura reporta exactamente lo que ve el estudiante en la interfaz.
  const { rms, mav, variance, energy } = computeEmgFeatures(values);
  out.emg = {
    seconds: values.length / fs, contractions: det.length,
    durationsMs: det.map((c) => Math.round(c.durationSeconds * 1000)),
    threshold: m + Math.max(2.5 * mad, 0.25 * m),
    rms, mav, variance, energy,
  };
}

writeFileSync("results/figures.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
