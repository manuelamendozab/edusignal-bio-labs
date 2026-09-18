import { describe, expect, it } from "vitest";

import {
  applySignalFilter,
  computeEmgFeatures,
  computeMetrics,
  computeSpectralAnalysis,
  computeRmsEnvelope,
  FILTERS_BY_MODALITY,
  isFilterAdmissible,
  detectContractions,
  detectRPeaks,
  getEducationalContent,
  getSignalChannel,
  rectifySignal,
  type SignalData,
} from "./signal-utils";

function makeSignal(values: number[], samplingRate: number): SignalData {
  return {
    name: "test",
    samples: values.length,
    samplingRate,
    time: values.map((_, index) => index / samplingRate),
    values,
    source: "test",
  };
}

function sinusoid(
  frequencyHz: number,
  samplingRate: number,
  sampleCount: number,
  amplitude = 1,
): number[] {
  return Array.from(
    { length: sampleCount },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / samplingRate),
  );
}

/** RMS del tramo estacionario (segunda mitad), evitando el transitorio inicial del IIR. */
function steadyStateRms(values: number[]): number {
  const tail = values.slice(Math.floor(values.length / 2));
  return Math.sqrt(tail.reduce((sum, value) => sum + value * value, 0) / tail.length);
}

/** Ganancia del filtro a una frecuencia dada, medida sobre la respuesta estacionaria. */
function gainAt(
  frequencyHz: number,
  filterType: Parameters<typeof applySignalFilter>[1],
  samplingRate = 500,
): number {
  const input = sinusoid(frequencyHz, samplingRate, samplingRate * 4);
  const output = applySignalFilter(makeSignal(input, samplingRate), filterType).values;
  return steadyStateRms(output) / steadyStateRms(input);
}

describe("applySignalFilter", () => {
  it("devuelve la señal intacta cuando no hay filtro", () => {
    const signal = makeSignal([1, 2, 3], 250);
    expect(applySignalFilter(signal, "none")).toBe(signal);
  });

  it("preserva la longitud de la señal en todos los filtros", () => {
    const input = sinusoid(10, 250, 500);
    for (const filterType of ["low-pass", "high-pass", "band-pass", "notch"] as const) {
      expect(applySignalFilter(makeSignal(input, 250), filterType).values).toHaveLength(
        input.length,
      );
    }
  });

  describe("pasa bajas (fc = 20 Hz)", () => {
    it("deja pasar la banda baja", () => {
      expect(gainAt(2, "low-pass")).toBeGreaterThan(0.9);
    });

    it("atenúa por encima de la frecuencia de corte", () => {
      expect(gainAt(120, "low-pass")).toBeLessThan(0.25);
    });

    it("es monótonamente decreciente en frecuencia", () => {
      const gains = [1, 5, 20, 60, 150].map((frequency) => gainAt(frequency, "low-pass"));
      for (let index = 1; index < gains.length; index += 1) {
        expect(gains[index]).toBeLessThan(gains[index - 1]);
      }
    });
  });

  describe("pasa altas (fc = 1 Hz)", () => {
    it("elimina la deriva de línea base", () => {
      const samplingRate = 250;
      const drift = Array.from(
        { length: 2500 },
        (_, index) => 3 + 0.5 * Math.sin((2 * Math.PI * 0.05 * index) / samplingRate),
      );
      const output = applySignalFilter(makeSignal(drift, samplingRate), "high-pass").values;
      const tail = output.slice(1250);
      const mean = tail.reduce((sum, value) => sum + value, 0) / tail.length;
      expect(Math.abs(mean)).toBeLessThan(0.05);
    });

    it("deja pasar los eventos rápidos", () => {
      expect(gainAt(40, "high-pass")).toBeGreaterThan(0.9);
    });
  });

  describe("pasa banda (1-40 Hz)", () => {
    // Regresión: la implementación previa restaba dos pasa bajas en cascada
    // y suprimía toda la banda útil, incluida la del complejo QRS.
    it("deja pasar la banda del complejo QRS", () => {
      expect(gainAt(10, "band-pass")).toBeGreaterThan(0.7);
    });

    it("atenúa la deriva por debajo de 1 Hz", () => {
      expect(gainAt(0.1, "band-pass")).toBeLessThan(0.15);
    });

    // La caída es de -20 dB/década por tratarse de secciones de primer orden:
    // a 150 Hz la ganancia teorica es (1-a)/|1-a*e^-jw| = 0,346.
    it("atenúa el ruido de alta frecuencia", () => {
      expect(gainAt(150, "band-pass")).toBeLessThan(0.35);
    });

    it("privilegia la banda de paso frente a ambos extremos", () => {
      const passBand = gainAt(10, "band-pass");
      expect(passBand).toBeGreaterThan(gainAt(0.1, "band-pass"));
      expect(passBand).toBeGreaterThan(gainAt(150, "band-pass"));
    });
  });

  describe("notch (60 Hz)", () => {
    // Regresión: la implementación previa aplicaba los términos feedforward
    // sobre salidas pasadas, de modo que no formaba un cero en 60 Hz.
    it("suprime la interferencia de red", () => {
      expect(gainAt(60, "notch")).toBeLessThan(0.1);
    });

    it("respeta las frecuencias vecinas", () => {
      expect(gainAt(10, "notch")).toBeGreaterThan(0.9);
      expect(gainAt(120, "notch")).toBeGreaterThan(0.9);
    });

    it("limpia una señal contaminada conservando la componente fisiológica", () => {
      const samplingRate = 500;
      const clean = sinusoid(10, samplingRate, 2000);
      const interference = sinusoid(60, samplingRate, 2000);
      const contaminated = clean.map((value, index) => value + interference[index]);

      const output = applySignalFilter(makeSignal(contaminated, samplingRate), "notch").values;
      const errorBefore = steadyStateRms(contaminated.map((value, index) => value - clean[index]));
      const errorAfter = steadyStateRms(output.map((value, index) => value - clean[index]));

      expect(errorAfter).toBeLessThan(errorBefore / 5);
    });
  });
});

describe("detectRPeaks", () => {
  const samplingRate = 250;

  /** Tren de latidos sintéticos: picos triangulares equiespaciados. */
  function beatTrain(beatIntervalSamples: number, beatCount: number, amplitude = 5): number[] {
    const values = new Array(beatIntervalSamples * beatCount).fill(0);
    for (let beat = 0; beat < beatCount; beat += 1) {
      const center = beat * beatIntervalSamples + Math.floor(beatIntervalSamples / 2);
      for (let offset = -3; offset <= 3; offset += 1) {
        values[center + offset] = amplitude * (1 - Math.abs(offset) / 4);
      }
    }
    return values;
  }

  it("devuelve vacío para señales demasiado cortas", () => {
    expect(detectRPeaks([1, 2, 3], samplingRate)).toEqual([]);
  });

  it("devuelve vacío para una señal plana sin eventos", () => {
    expect(detectRPeaks(new Array(1000).fill(0), samplingRate)).toEqual([]);
  });

  it("detecta todos los latidos de un tren sintético", () => {
    const peaks = detectRPeaks(beatTrain(200, 12), samplingRate);
    expect(peaks).toHaveLength(12);
  });

  it("localiza cada latido en su posición esperada", () => {
    const peaks = detectRPeaks(beatTrain(200, 8), samplingRate);
    peaks.forEach((peak, index) => {
      expect(Math.abs(peak - (index * 200 + 100))).toBeLessThanOrEqual(2);
    });
  });

  it("respeta el periodo refractario de 0,28 s", () => {
    const minDistance = Math.round(samplingRate * 0.28);
    const peaks = detectRPeaks(beatTrain(80, 20), samplingRate);
    for (let index = 1; index < peaks.length; index += 1) {
      expect(peaks[index] - peaks[index - 1]).toBeGreaterThanOrEqual(minDistance);
    }
  });

  it("es robusto frente a la deriva de línea base", () => {
    const base = beatTrain(200, 10);
    const drifted = base.map(
      (value, index) => value + 2 * Math.sin((2 * Math.PI * 0.05 * index) / samplingRate),
    );
    const filtered = applySignalFilter(makeSignal(drifted, samplingRate), "high-pass").values;
    expect(detectRPeaks(filtered, samplingRate)).toHaveLength(10);
  });
});

describe("computeMetrics", () => {
  const samplingRate = 250;

  it("devuelve ceros cuando no hay latidos", () => {
    expect(computeMetrics(makeSignal(new Array(100).fill(0), samplingRate), [])).toEqual({
      bpm: 0,
      rrMeanMs: 0,
      sdnnMs: 0,
      rmssdMs: 0,
      pnn50: 0,
      beatCount: 0,
    });
  });

  it("calcula BPM e intervalo RR de un ritmo conocido", () => {
    // Un latido cada 200 muestras a 250 Hz => RR = 800 ms => 75 BPM.
    const values = new Array(2000).fill(0);
    const peaks = Array.from({ length: 10 }, (_, index) => index * 200);
    const metrics = computeMetrics(makeSignal(values, samplingRate), peaks);

    expect(metrics.beatCount).toBe(10);
    expect(metrics.rrMeanMs).toBeCloseTo(800, 1);
    expect(metrics.bpm).toBeCloseTo(75, 0);
  });

  it("no reporta variabilidad en un ritmo perfectamente regular", () => {
    // RR constante de 800 ms: SDNN, RMSSD y pNN50 deben ser cero.
    const values = new Array(2000).fill(0);
    const peaks = Array.from({ length: 10 }, (_, index) => index * 200);
    const metrics = computeMetrics(makeSignal(values, samplingRate), peaks);

    expect(metrics.sdnnMs).toBeCloseTo(0, 6);
    expect(metrics.rmssdMs).toBeCloseTo(0, 6);
    expect(metrics.pnn50).toBeCloseTo(0, 6);
  });

  it("calcula SDNN, RMSSD y pNN50 de una serie RR conocida", () => {
    // Picos en 0, 200, 450, 650 muestras a 250 Hz => RR = [800, 1000, 800] ms.
    //   RR medio = 866.67 ms
    //   SDNN  = sqrt(((-66.67)^2 + 133.33^2 + (-66.67)^2) / 2) = 115.47 ms
    //   diffs = [200, -200] => RMSSD = 200 ms, pNN50 = 100 %
    const metrics = computeMetrics(makeSignal(new Array(700).fill(0), samplingRate), [0, 200, 450, 650]);

    expect(metrics.rrMeanMs).toBeCloseTo(866.7, 1);
    expect(metrics.sdnnMs).toBeCloseTo(115.5, 1);
    expect(metrics.rmssdMs).toBeCloseTo(200, 1);
    expect(metrics.pnn50).toBeCloseTo(100, 1);
  });

  it("no calcula variabilidad con un solo intervalo RR", () => {
    const metrics = computeMetrics(makeSignal(new Array(500).fill(0), samplingRate), [0, 200]);

    expect(metrics.beatCount).toBe(2);
    expect(metrics.rrMeanMs).toBeCloseTo(800, 1);
    expect(metrics.sdnnMs).toBe(0);
    expect(metrics.rmssdMs).toBe(0);
  });

  it("encadena detección y métricas de forma coherente", () => {
    const values = new Array(2500).fill(0);
    for (let beat = 0; beat < 12; beat += 1) {
      const center = beat * 200 + 100;
      for (let offset = -3; offset <= 3; offset += 1) {
        values[center + offset] = 5 * (1 - Math.abs(offset) / 4);
      }
    }

    const signal = makeSignal(values, samplingRate);
    const metrics = computeMetrics(signal, detectRPeaks(values, samplingRate));

    expect(metrics.rrMeanMs).toBeCloseTo(800, 0);
    expect(metrics.bpm).toBeGreaterThan(60);
    expect(metrics.bpm).toBeLessThan(90);
  });
});

describe("computeSpectralAnalysis", () => {
  const samplingRate = 128;
  const sampleCount = 256;

  it("devuelve una estructura vacía para señales ausentes", () => {
    const result = computeSpectralAnalysis(null);
    expect(result.dominantFrequency).toBe(0);
    expect(result.powerSpectrum).toEqual([]);
  });

  it("identifica la frecuencia dominante de una sinusoide pura", () => {
    const signal = makeSignal(sinusoid(10, samplingRate, sampleCount), samplingRate);
    expect(computeSpectralAnalysis(signal).dominantFrequency).toBeCloseTo(10, 1);
  });

  it("asigna la potencia a la banda fisiológica correcta", () => {
    const cases: Array<[number, keyof ReturnType<typeof computeSpectralAnalysis>["bandPowers"]]> = [
      [2, "delta"],
      [6, "theta"],
      [10, "alpha"],
      [20, "beta"],
      [40, "gamma"],
    ];

    for (const [frequency, expectedBand] of cases) {
      const { bandPowers } = computeSpectralAnalysis(
        makeSignal(sinusoid(frequency, samplingRate, sampleCount), samplingRate),
      );
      const dominant = (Object.keys(bandPowers) as Array<keyof typeof bandPowers>).reduce(
        (best, band) => (bandPowers[band] > bandPowers[best] ? band : best),
      );
      expect(dominant).toBe(expectedBand);
    }
  });

  it("ignora la continua y la interferencia de red al buscar la frecuencia dominante", () => {
    // Offset grande, deriva lenta y 60 Hz mas intensos que el ritmo de 10 Hz.
    const values = sinusoid(10, 160, 1600).map(
      (value, n) => value + 5 + 3 * Math.sin((2 * Math.PI * 0.1 * n) / 160) + 2 * Math.sin((2 * Math.PI * 60 * n) / 160),
    );
    expect(computeSpectralAnalysis(makeSignal(values, 160)).dominantFrequency).toBeCloseTo(10, 1);
  });

  it("devuelve el eje de frecuencias unilateral hasta Nyquist inclusive", () => {
    const { frequencies, segmentLength } = computeSpectralAnalysis(
      makeSignal(sinusoid(10, samplingRate, sampleCount), samplingRate),
    );
    // PSD unilateral: N/2 + 1 bins, el ultimo exactamente en Nyquist.
    expect(frequencies).toHaveLength(Math.floor(segmentLength / 2) + 1);
    expect(frequencies[frequencies.length - 1]).toBeCloseTo(samplingRate / 2, 6);
  });

  it("reparte la potencia entre dos componentes espectrales", () => {
    const mixed = sinusoid(10, samplingRate, sampleCount).map(
      (value, index) => value + sinusoid(20, samplingRate, sampleCount)[index],
    );
    const { bandPowers } = computeSpectralAnalysis(makeSignal(mixed, samplingRate));
    expect(bandPowers.alpha).toBeGreaterThan(0);
    expect(bandPowers.beta).toBeGreaterThan(0);
    expect(bandPowers.delta).toBeLessThan(bandPowers.alpha);
  });
});

describe("getSignalChannel", () => {
  it("recurre a values cuando no hay multicanal", () => {
    const signal = makeSignal([1, 2, 3], 250);
    expect(getSignalChannel(signal, 0)).toEqual([1, 2, 3]);
  });

  it("devuelve el canal solicitado", () => {
    const signal = {
      ...makeSignal([1, 2, 3], 250),
      channels: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    };
    expect(getSignalChannel(signal, 1)).toEqual([4, 5, 6]);
  });

  it("recurre a values ante un índice inexistente", () => {
    const signal = { ...makeSignal([1, 2, 3], 250), channels: [[1, 2, 3]] };
    expect(getSignalChannel(signal, 7)).toEqual([1, 2, 3]);
  });
});

describe("getEducationalContent", () => {
  it("describe cada filtro con contenido propio", () => {
    const titles = (["low-pass", "high-pass", "notch", "none"] as const).map(
      (filterType) => getEducationalContent(filterType).title,
    );
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("entrega los cuatro campos didácticos", () => {
    const content = getEducationalContent("low-pass");
    expect(content.title).toBeTruthy();
    expect(content.description).toBeTruthy();
    expect(content.why).toBeTruthy();
    expect(content.physiology).toBeTruthy();
  });
});

describe("detectContractions", () => {
  const samplingRate = 1000;

  /** Rafaga de ruido de amplitud `amp` entre `a` y `b` segundos sobre una base plana. */
  function burstSignal(amp: number, bursts: Array<[number, number]>, seconds: number): number[] {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    const values = new Array(seconds * samplingRate).fill(0).map(() => 0.02 * amp * rand());
    for (const [a, b] of bursts) {
      for (let i = Math.round(a * samplingRate); i < Math.round(b * samplingRate); i += 1) {
        values[i] += amp * rand();
      }
    }
    return values.map(Math.abs);
  }

  it("segmenta con umbral relativo señales de amplitudes muy distintas", () => {
    // El umbral es relativo a la mediana, asi que una señal 100 veces menor
    // debe producir la misma segmentacion que una de amplitud nominal.
    for (const amp of [1, 0.01]) {
      const envelope = computeRmsEnvelope(burstSignal(amp, [[1, 2], [3, 4]], 5), samplingRate);
      expect(detectContractions(envelope, samplingRate)).toHaveLength(2);
    }
  });

  it("descarta los episodios mas cortos que la duracion minima", () => {
    // 30 ms queda por debajo del minimo de 100 ms y debe ignorarse.
    const envelope = computeRmsEnvelope(burstSignal(1, [[1, 1.03]], 3), samplingRate);
    expect(detectContractions(envelope, samplingRate)).toHaveLength(0);
  });
});

describe("computeEmgFeatures", () => {
  it("rectifica antes de medir, de modo que el signo no altera los descriptores", () => {
    // RMS, MAV, varianza y energia se definen sobre xr[n] = |x[n]|, asi que una
    // señal y su reflejo en el eje temporal deben dar exactamente lo mismo.
    const values = [0.4, -0.3, 0.2, -0.5, 0.1];
    expect(computeEmgFeatures(values)).toEqual(computeEmgFeatures(values.map((v) => -v)));
    expect(rectifySignal(values)).toEqual([0.4, 0.3, 0.2, 0.5, 0.1]);
  });

  it("reproduce los valores analiticos de una señal conocida", () => {
    // Sobre [3, -4]: xr = [3, 4]; energia 25, RMS sqrt(12.5), MAV 3.5 y
    // varianza 1/2*((3-3.5)^2 + (4-3.5)^2) = 0.25.
    const features = computeEmgFeatures([3, -4]);
    expect(features.energy).toBeCloseTo(25, 10);
    expect(features.rms).toBeCloseTo(Math.sqrt(12.5), 10);
    expect(features.mav).toBeCloseTo(3.5, 10);
    expect(features.variance).toBeCloseTo(0.25, 10);
  });

  it("escala la energia con la duracion y deja RMS y MAV invariantes", () => {
    // La energia es una suma, no un promedio: solo es comparable entre
    // segmentos de igual longitud, como advierte la documentacion del modulo.
    const segment = [0.2, -0.4, 0.6, -0.1];
    const single = computeEmgFeatures(segment);
    const doubled = computeEmgFeatures([...segment, ...segment]);

    expect(doubled.energy).toBeCloseTo(2 * single.energy, 10);
    expect(doubled.rms).toBeCloseTo(single.rms, 10);
    expect(doubled.mav).toBeCloseTo(single.mav, 10);
  });

  it("devuelve ceros ante una señal vacia en lugar de NaN", () => {
    expect(computeEmgFeatures([])).toEqual({ rms: 0, mav: 0, variance: 0, energy: 0 });
  });
});

describe("protocolo de filtrado", () => {
  it("rechaza los filtros que alcanzan el limite de Nyquist", () => {
    // A 100 Hz, Nyquist es 50 Hz: el notch de 60 Hz no es realizable.
    expect(isFilterAdmissible("notch", 100)).toBe(false);
    expect(isFilterAdmissible("band-pass", 100)).toBe(true);
    expect(isFilterAdmissible("none", 1)).toBe(true);
  });

  it("devuelve la señal intacta si el filtro no es realizable", () => {
    const signal = makeSignal(sinusoid(10, 100, 200), 100);
    expect(applySignalFilter(signal, "notch")).toBe(signal);
  });

  it("asigna a cada modalidad un conjunto de filtros compatible con su banda", () => {
    expect(FILTERS_BY_MODALITY.emg).toEqual(["none"]);
    expect(FILTERS_BY_MODALITY.eeg).not.toContain("low-pass");
    expect(FILTERS_BY_MODALITY.ecg).toContain("band-pass");
  });
});
