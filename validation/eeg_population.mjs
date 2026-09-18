// EEG basal de los 109 sujetos: ojos abiertos (R01) frente a ojos cerrados (R02), canal Oz.
// La supresion del ritmo alfa al abrir los ojos (efecto Berger) actua como referencia fisiologica.
import { existsSync, writeFileSync } from "node:fs";
import { applySignalFilter, computeSpectralAnalysis } from "./.build/signal-utils.mjs";
import { loadEdf, pickChannel } from "./lib/load.mjs";
import { median, quantile, toSignal } from "./lib/stats.mjs";

const CHANNEL = "Oz", EXPECTED_FS = 160;
const rows = [], excluded = [];

function spectral(signal) {
  const r = computeSpectralAnalysis(signal);
  const total = Object.values(r.bandPowers).reduce((a, b) => a + b, 0);
  return { fdom: r.dominantFrequency, alpha: r.bandPowers.alpha, alphaRel: r.bandPowers.alpha / total,
           topBand: Object.entries(r.bandPowers).reduce((b, e) => (e[1] > b[1] ? e : b))[0] };
}

async function analyse(path) {
  const signal = await loadEdf(path);
  const fs = signal.samplingRate;
  if (fs !== EXPECTED_FS) return { fs };
  const { values } = pickChannel(signal, new RegExp(`^${CHANNEL}$`, "i"));
  const raw = toSignal(CHANNEL, values, fs);
  return { fs, none: spectral(raw), hp: spectral(applySignalFilter(raw, "high-pass")) };
}

for (let i = 1; i <= 109; i += 1) {
  const id = `S${String(i).padStart(3, "0")}`;
  const p1 = `data/eegmmidb/${id}R01.edf`, p2 = `data/eegmmidb/${id}R02.edf`;
  if (!existsSync(p1) || !existsSync(p2)) { excluded.push([id, "missing"]); continue; }
  const open = await analyse(p1), closed = await analyse(p2);
  if (open.fs !== EXPECTED_FS || closed.fs !== EXPECTED_FS) { excluded.push([id, `fs=${closed.fs}`]); continue; }
  rows.push({ id, open, closed });
}

const n = rows.length;
const inAlpha = (f) => f >= 8 && f < 13;
function summarise(key) {
  const ratio = rows.map((r) => r.closed[key].alpha / r.open[key].alpha);
  const side = (state) => ({
    fdomInAlpha: rows.filter((r) => inAlpha(r[state][key].fdom)).length,
    fdomAtLowEdge: rows.filter((r) => r[state][key].fdom < 1).length,
    alphaTopBand: rows.filter((r) => r[state][key].topBand === "alpha").length,
    medianAlphaRel: median(rows.map((r) => r[state][key].alphaRel)),
  });
  return {
    closed: side("closed"), open: side("open"),
    reactivity: { increased: ratio.filter((x) => x > 1).length, medianRatio: median(ratio),
                  q25: quantile(ratio, 0.25), q75: quantile(ratio, 0.75) },
  };
}
const out = { subjects: n, excluded, none: summarise("none"), highPass: summarise("hp") };
writeFileSync("results/eeg_population.json", JSON.stringify({ ...out, rows }, null, 2));
console.log(JSON.stringify({ ...out, excluded: excluded.map((e) => e.join(":")) }, null, 1));
