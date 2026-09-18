import { readFileSync } from "node:fs";

/** Lector minimo de EDF (cabecera ASCII + registros int16 little-endian). */
export function readEdf(path) {
  const b = readFileSync(path);
  const str = (off, len) => b.toString("ascii", off, off + len).trim();
  const headerBytes = Number.parseInt(str(184, 8), 10);
  const records = Number.parseInt(str(236, 8), 10);
  const recordSeconds = Number.parseFloat(str(244, 8));
  const ns = Number.parseInt(str(252, 4), 10);
  const field = (k, width, i) => str(256 + ns * k + i * width, width);
  const labels = Array.from({ length: ns }, (_, i) => field(0, 16, i).replace(/\.+$/, ""));
  const spr = Array.from({ length: ns }, (_, i) => Number.parseInt(field(216, 8, i), 10));
  const perRecord = spr.reduce((a, c) => a + c, 0);

  function channel(index) {
    const pMin = Number.parseFloat(field(104, 8, index));
    const pMax = Number.parseFloat(field(112, 8, index));
    const dMin = Number.parseInt(field(120, 8, index), 10);
    const dMax = Number.parseInt(field(128, 8, index), 10);
    const scale = (pMax - pMin) / (dMax - dMin);
    const offset = spr.slice(0, index).reduce((a, c) => a + c, 0);
    const values = [];
    for (let r = 0; r < records; r += 1) {
      const start = headerBytes + (r * perRecord + offset) * 2;
      for (let k = 0; k < spr[index]; k += 1) values.push(pMin + (b.readInt16LE(start + k * 2) - dMin) * scale);
    }
    return { fs: spr[index] / recordSeconds, values };
  }

  return { labels, channel };
}
