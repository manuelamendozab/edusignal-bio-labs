export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
export const toSignal = (name, values, fs) => ({ name, samples: values.length, samplingRate: fs, time: values.map((_, i) => i / fs), values, source: "validation" });
export const MITDB = "100 101 103 105 106 108 109 111 112 113 114 115 116 117 118 119 121 122 123 124 200 201 202 203 205 207 208 209 210 212 213 214 215 219 220 221 222 223 228 230 231 232 233 234".split(" ");
export const mlii = (h) => { const i = h.signals.findIndex((s) => /mlii/i.test(s.desc)); return i >= 0 ? i : 0; };
