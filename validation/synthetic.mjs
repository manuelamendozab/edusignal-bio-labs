// Verificacion de las cadenas EEG y EMG contra verdad-terreno sintetica.
import { writeFileSync } from "node:fs";
import { computeRmsEnvelope, computeSpectralAnalysis, detectContractions } from "./.build/signal-utils.mjs";
import { mean, toSignal } from "./lib/stats.mjs";

let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

// EEG
const FS_EEG = 160, N = FS_EEG * 60;
const cases = [[2, "delta"], [3.1, "delta"], [6, "theta"], [7.4, "theta"], [10, "alpha"], [10.1, "alpha"],
               [12, "alpha"], [20, "beta"], [23.37, "beta"], [25, "beta"], [35, "gamma"], [45, "gamma"]];
const freqErr = [];
let bandHits = 0;
for (const [f, band] of cases) {
  const v = Array.from({ length: N }, (_, n) => Math.sin((2 * Math.PI * f * n) / FS_EEG) + 0.3 * rand());
  const r = computeSpectralAnalysis(toSignal("s", v, FS_EEG));
  freqErr.push(Math.abs(r.dominantFrequency - f));
  const top = Object.entries(r.bandPowers).reduce((b, e) => (e[1] > b[1] ? e : b))[0];
  if (top === band) bandHits += 1;
}
const A = 2;
const pure = computeSpectralAnalysis(toSignal("p", Array.from({ length: N }, (_, n) => A * Math.sin((2 * Math.PI * 10 * n) / FS_EEG)), FS_EEG));
const power = Object.values(pure.bandPowers).reduce((a, b) => a + b, 0);

// EMG
const FS_EMG = 4000;
const truth = [[1.0, 1.8], [3.2, 4.1], [5.5, 6.9], [8.0, 8.6]];
const emg = Array.from({ length: 10 * FS_EMG }, () => 0.02 * rand());
for (const [a, b] of truth) for (let i = Math.round(a * FS_EMG); i < Math.round(b * FS_EMG); i += 1) emg[i] += 0.5 * rand();
const det = detectContractions(computeRmsEnvelope(emg.map(Math.abs), FS_EMG), FS_EMG);
const onErr = [], offErr = [];
truth.forEach(([a, b], i) => {
  if (!det[i]) return;
  onErr.push(Math.abs(det[i].onset / FS_EMG - a) * 1000);
  offErr.push(Math.abs(det[i].offset / FS_EMG - b) * 1000);
});
const meanBurst = mean(truth.map(([a, b]) => (b - a) * 1000));

const out = {
  eeg: { cases: cases.length, meanFreqErr: mean(freqErr), maxFreqErr: Math.max(...freqErr), bandHits,
         parsevalPower: power, parsevalExpected: (A * A) / 2, parsevalErrPct: (100 * Math.abs(power - (A * A) / 2)) / ((A * A) / 2) },
  emg: { truth: truth.length, detected: det.length, onsetMae: mean(onErr), offsetMae: mean(offErr),
         errPctOfBurst: (100 * mean([...onErr, ...offErr])) / meanBurst },
};
writeFileSync("results/synthetic.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
