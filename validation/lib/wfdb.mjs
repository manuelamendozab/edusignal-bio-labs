import { readFileSync } from "node:fs";

/** Codigos WFDB de anotacion de latido (conjunto estandar de MIT-BIH). */
export const BEAT_CODES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 25, 34, 35, 38, 41]);

export function readHeader(dir, record) {
  const lines = readFileSync(`${dir}/${record}.hea`, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const [, signalCount, fs, sampleCount] = lines[0].trim().split(/\s+/);
  const signals = lines.slice(1).map((line) => {
    const p = line.trim().split(/\s+/);
    // Campo 3: "gain(baseline)/units". Campo 5: adcZero, baseline por defecto.
    const gainField = p[2] || "200";
    const adcZero = Number.parseInt(p[4], 10);
    const explicit = gainField.includes("(") ? Number.parseInt(gainField.split("(")[1], 10) : NaN;
    return {
      format: Number.parseInt(p[1], 10),
      gain: Number.parseFloat(gainField.split("(")[0].split("/")[0]) || 200,
      units: gainField.includes("/") ? gainField.split("/")[1] : "mV",
      baseline: Number.isFinite(explicit) ? explicit : Number.isFinite(adcZero) ? adcZero : 0,
      checksum: Number.parseInt(p[6], 10),
      desc: p.slice(8).join(" "),
    };
  });
  return { signalCount: Number(signalCount), fs: Number(fs), sampleCount: Number(sampleCount), signals };
}

/** Lee un canal en unidades fisicas. Soporta los formatos 212 y 16. */
export function readRecord(dir, record, channel = 0) {
  const header = readHeader(dir, record);
  const raw = readFileSync(`${dir}/${record}.dat`);
  const n = header.signalCount;
  const spec = header.signals[channel] ?? header.signals[0];

  if (spec.format === 16) {
    const count = Math.floor(raw.length / (2 * n));
    const values = new Array(count);
    for (let i = 0; i < count; i += 1) values[i] = (raw.readInt16LE((i * n + channel) * 2) - spec.baseline) / spec.gain;
    return { fs: header.fs, values, raw: null };
  }

  // Formato 212: dos muestras de 12 bits empaquetadas en 3 bytes.
  const total = Math.floor((raw.length * 2) / 3);
  const flat = new Int16Array(total);
  let out = 0;
  for (let i = 0; i + 2 < raw.length && out + 1 < total; i += 3) {
    let s1 = ((raw[i + 1] & 0x0f) << 8) | raw[i];
    let s2 = ((raw[i + 1] & 0xf0) << 4) | raw[i + 2];
    if (s1 > 2047) s1 -= 4096;
    if (s2 > 2047) s2 -= 4096;
    flat[out++] = s1;
    flat[out++] = s2;
  }
  const count = Math.floor(total / n);
  const counts = new Int16Array(count);
  const values = new Array(count);
  for (let i = 0; i < count; i += 1) {
    counts[i] = flat[i * n + channel];
    values[i] = (counts[i] - spec.baseline) / spec.gain;
  }
  return { fs: header.fs, values, raw: counts };
}

/** Suma de control WFDB (16 bits con signo) de un canal, para verificar la decodificacion. */
export function checksum(raw) {
  let sum = 0;
  for (const v of raw) sum += v;
  return ((sum & 0xffff) ^ 0x8000) - 0x8000;
}

/** Indices de muestra de las anotaciones de latido. */
export function readAnnotations(dir, record) {
  const buf = readFileSync(`${dir}/${record}.atr`);
  const times = [];
  let t = 0;
  let i = 0;
  while (i + 1 < buf.length) {
    const word = buf[i] | (buf[i + 1] << 8);
    const code = word >> 10;
    const interval = word & 0x3ff;
    i += 2;
    if (code === 0 && interval === 0) break;
    // SKIP: el intervalo ocupa las dos palabras siguientes, la primera es la parte alta.
    if (code === 59) { t += (buf[i] | (buf[i + 1] << 8)) * 65536 + (buf[i + 2] | (buf[i + 3] << 8)); i += 4; continue; }
    if (code === 60 || code === 61 || code === 62) continue;
    if (code === 63) { i += interval + (interval % 2); continue; }
    t += interval;
    if (BEAT_CODES.has(code)) times.push(t);
  }
  return times;
}
