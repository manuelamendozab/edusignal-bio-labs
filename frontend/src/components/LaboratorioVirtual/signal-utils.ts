export type SignalData = {
  name: string;
  samples: number;
  samplingRate: number;
  time: number[];
  values: number[];
  source: string;
  units?: string;
  channels?: number[][];
  channelNames?: string[];
};

export type FilterType = "none" | "low-pass" | "high-pass" | "notch" | "band-pass";

export type MetricSummary = {
  bpm: number;
  rrAverageMs: number;
  beatCount: number;
};

export type EducationalContent = {
  title: string;
  description: string;
  why: string;
  physiology: string;
};

const DEFAULT_SAMPLING_RATE = 250;

function parseNumber(value: string): number {
  const normalized = value.replace(/,/g, ".").trim();
  return Number(normalized);
}

function detectDelimiter(line: string): string {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function findColumnIndex(headers: string[], candidates: string[]): number | null {
  const normalized = headers.map((value) => value.toLowerCase().trim());
  for (const candidate of candidates) {
    const index = normalized.findIndex((value) => value.includes(candidate));
    if (index >= 0) return index;
  }
  return null;
}

function parseWfdbHeader(headerText: string) {
  const lines = headerText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("El archivo .hea está vacío.");
  }

  const headerFields = lines[0].split(/\s+/);
  const samplingRate = Number.parseInt(headerFields[2] ?? "250", 10);
  const sampleCount = Number.parseInt(headerFields[3] ?? "0", 10);

  let signalName = headerFields[0] ?? "wfdb";
  for (const line of lines.slice(1)) {
    if (line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      signalName = parts[parts.length - 1] || signalName;
      break;
    }
  }

  return {
    samplingRate: Number.isFinite(samplingRate) ? samplingRate : 250,
    sampleCount: Number.isFinite(sampleCount) ? sampleCount : 0,
    signalName,
  };
}

function decodeWfdb212(bytes: Uint8Array): number[] {
  const values: number[] = [];

  for (let index = 0; index + 2 < bytes.length; index += 3) {
    const firstByte = bytes[index];
    const secondByte = bytes[index + 1];
    const thirdByte = bytes[index + 2];

    const firstSample = ((firstByte << 4) | (secondByte >> 4)) & 0x0fff;
    const secondSample = (((secondByte & 0x0f) << 8) | thirdByte) & 0x0fff;

    values.push(firstSample - 1024, secondSample - 1024);
  }

  return values;
}

function decodeWfdb16(bytes: Uint8Array): number[] {
  const values: number[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  for (let index = 0; index + 1 < bytes.length; index += 2) {
    values.push(view.getInt16(index, false));
  }

  return values;
}

export async function parseWfdbSignal(datFile: File, headerFile: File): Promise<SignalData> {
  const [headerText, datBuffer] = await Promise.all([headerFile.text(), datFile.arrayBuffer()]);
  const header = parseWfdbHeader(headerText);
  const bytes = new Uint8Array(datBuffer);

  const signalLine = headerText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  const formatToken = signalLine?.split(/\s+/)[1] ?? "212";
  const formatCode = Number.parseInt(formatToken, 10);
  const values = formatCode === 16 ? decodeWfdb16(bytes) : decodeWfdb212(bytes);
  const sampleCount = header.sampleCount > 0 ? Math.min(header.sampleCount, values.length) : values.length;

  return {
    name: `${datFile.name} + ${headerFile.name}`,
    samples: sampleCount,
    samplingRate: header.samplingRate,
    time: Array.from({ length: sampleCount }, (_, index) => index / header.samplingRate),
    values: values.slice(0, sampleCount),
    source: "wfdb",
    units: "mV",
  };
}

export function parseCsvSignal(file: File): Promise<SignalData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (!lines.length) {
          throw new Error("El archivo está vacío.");
        }

        const delimiter = detectDelimiter(lines[0]);
        const rows = lines.map((line) => line.split(delimiter));

        const headerLine = rows[0];
        const headerIsText = headerLine.some((cell) => /time|value|signal|ecg|eeg|channel|amplitude|voltage|mV|mv/i.test(cell));
        const dataRows = headerIsText ? rows.slice(1) : rows;
        const numericRows = dataRows.filter((row) => row.some((cell) => !Number.isNaN(parseNumber(cell))));

        if (!numericRows.length) {
          throw new Error("No se pudieron encontrar valores numéricos en el archivo.");
        }

        const headers = headerIsText ? headerLine : numericRows[0].map((_, index) => `col${index + 1}`);
        const parsedRows = numericRows.map((row) => row.map((cell) => parseNumber(cell)));
        const columns = parsedRows[0].map((_, columnIndex) => parsedRows.map((row) => row[columnIndex]));
        const timeIndex = findColumnIndex(headers, ["time", "t", "sample", "samples", "index", "i"]);

        let time: number[] = [];
        let channelColumns: number[][] = [];
        let channelNames: string[] = [];

        if (timeIndex !== null) {
          time = columns[timeIndex] ?? [];
          channelColumns = columns.filter((_, index) => index !== timeIndex);
          channelNames = headers.filter((_, index) => index !== timeIndex).map((name, index) => name || `Canal ${index + 1}`);
        } else if (columns.length >= 2) {
          time = columns[0] ?? [];
          channelColumns = columns.slice(1);
          channelNames = headers.slice(1).map((name, index) => name || `Canal ${index + 1}`);
        } else {
          channelColumns = columns;
          channelNames = headers.map((name, index) => name || `Canal ${index + 1}`);
        }

        const cleanedTime = time.filter((value) => Number.isFinite(value));
        const cleanedChannels = channelColumns.map((column) => column.filter((value) => Number.isFinite(value)));
        const firstChannel = cleanedChannels[0] ?? [];
        const commonLength = Math.min(cleanedTime.length, firstChannel.length);
        const alignedTime = cleanedTime.slice(0, commonLength);
        const alignedValues = firstChannel.slice(0, commonLength);

        let samplingRate = DEFAULT_SAMPLING_RATE;
        if (alignedTime.length > 1) {
          const diffs = alignedTime
            .slice(1)
            .map((value, index) => value - alignedTime[index])
            .filter((value) => value > 0);
          const medianDiff = diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)] ?? 0;
          if (medianDiff > 0) {
            samplingRate = Math.round(1 / medianDiff);
          }
        }

        const channels = cleanedChannels.map((column) => column.slice(0, commonLength));

        resolve({
          name: file.name,
          samples: alignedValues.length,
          samplingRate: Number.isFinite(samplingRate) ? samplingRate : DEFAULT_SAMPLING_RATE,
          time: alignedTime.length ? alignedTime : alignedValues.map((_, index) => index / DEFAULT_SAMPLING_RATE),
          values: alignedValues,
          source: "csv",
          units: "mV",
          channels: channels.length > 1 ? channels : undefined,
          channelNames: channels.length > 1 ? channelNames : undefined,
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("No se pudo leer el archivo CSV."));
      }
    };

    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado."));
    reader.readAsText(file);
  });
}

export function getSignalChannel(signal: SignalData, channelIndex: number): number[] {
  if (!signal.channels?.[channelIndex]?.length) {
    return signal.values;
  }

  return signal.channels[channelIndex];
}

export function computeSpectralAnalysis(signal: SignalData | null) {
  if (!signal?.values.length) {
    return {
      frequencies: [] as number[],
      powerSpectrum: [] as number[],
      bandPowers: {
        delta: 0,
        theta: 0,
        alpha: 0,
        beta: 0,
        gamma: 0,
      },
      dominantFrequency: 0,
    };
  }

  const values = signal.values;
  const sampleCount = values.length;
  const samplingRate = signal.samplingRate || DEFAULT_SAMPLING_RATE;
  const halfCount = Math.floor(sampleCount / 2);
  const magnitudes: number[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    let real = 0;
    let imaginary = 0;

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const angle = (-2 * Math.PI * index * sampleIndex) / sampleCount;
      real += values[sampleIndex] * Math.cos(angle);
      imaginary += values[sampleIndex] * Math.sin(angle);
    }

    magnitudes.push(Math.sqrt(real * real + imaginary * imaginary) / sampleCount);
  }

  const frequencies = Array.from({ length: halfCount }, (_, index) => (index * samplingRate) / sampleCount);
  const powerSpectrum = magnitudes.slice(0, halfCount).map((magnitude) => magnitude * magnitude);

  const bandPowers = {
    delta: sumBandPower(powerSpectrum, frequencies, 0.5, 4),
    theta: sumBandPower(powerSpectrum, frequencies, 4, 8),
    alpha: sumBandPower(powerSpectrum, frequencies, 8, 13),
    beta: sumBandPower(powerSpectrum, frequencies, 13, 30),
    gamma: sumBandPower(powerSpectrum, frequencies, 30, 50),
  };

  const dominantIndex = powerSpectrum.reduce((bestIndex, value, index, array) => (value > array[bestIndex] ? index : bestIndex), 0);

  return {
    frequencies,
    powerSpectrum,
    bandPowers,
    dominantFrequency: frequencies[dominantIndex] ?? 0,
  };
}

function sumBandPower(powerSpectrum: number[], frequencies: number[], minFrequency: number, maxFrequency: number): number {
  return powerSpectrum.reduce((sum, power, index) => {
    const frequency = frequencies[index];
    if (frequency >= minFrequency && frequency < maxFrequency) {
      return sum + power;
    }
    return sum;
  }, 0);
}

function movingAverage(values: number[], window: number): number[] {
  const radius = Math.max(1, Math.floor(window / 2));
  const output = new Array(values.length).fill(0);

  values.forEach((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length, index + radius + 1);
    const slice = values.slice(start, end);
    output[index] = slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });

  return output;
}

export function applySignalFilter(signal: SignalData, filterType: FilterType): SignalData {
  if (filterType === "none") {
    return signal;
  }

  const values = signal.values;
  const sampleRate = signal.samplingRate;
  let filteredValues: number[] = [...values];

  if (filterType === "low-pass") {
    const alpha = Math.exp(-2 * Math.PI * 20 / sampleRate);
    filteredValues = values.reduce<number[]>((accumulator, value, index) => {
      if (index === 0) {
        accumulator.push(value);
      } else {
        const previous = accumulator[index - 1] ?? value;
        accumulator.push(alpha * previous + (1 - alpha) * value);
      }
      return accumulator;
    }, []);
  }

  if (filterType === "high-pass") {
    const alpha = Math.exp(-2 * Math.PI * 1 / sampleRate);
    const lowPass = values.reduce<number[]>((accumulator, value, index) => {
      if (index === 0) {
        accumulator.push(value);
      } else {
        const previous = accumulator[index - 1] ?? value;
        accumulator.push(alpha * previous + (1 - alpha) * value);
      }
      return accumulator;
    }, []);

    filteredValues = values.map((value, index) => value - lowPass[index]);
  }

  if (filterType === "band-pass") {
    const highPass = values.reduce<number[]>((accumulator, value, index) => {
      if (index === 0) {
        accumulator.push(value);
      } else {
        const alpha = Math.exp(-2 * Math.PI * 1 / sampleRate);
        const previous = accumulator[index - 1] ?? value;
        accumulator.push(alpha * previous + (1 - alpha) * value);
      }
      return accumulator;
    }, []);

    const lowPassValues = highPass.reduce<number[]>((accumulator, value, index) => {
      if (index === 0) {
        accumulator.push(value);
      } else {
        const alpha = Math.exp(-2 * Math.PI * 40 / sampleRate);
        const previous = accumulator[index - 1] ?? value;
        accumulator.push(alpha * previous + (1 - alpha) * value);
      }
      return accumulator;
    }, []);

    filteredValues = lowPassValues.map((value, index) => value - (highPass[index] ?? value));
  }

  if (filterType === "notch") {
    const notchHz = 60;
    const r = 0.995;
    const omega = (2 * Math.PI * notchHz) / sampleRate;
    const cosine = Math.cos(omega);

    filteredValues = values.reduce<number[]>((accumulator, value, index) => {
      if (index === 0 || index === 1) {
        accumulator.push(value);
        return accumulator;
      }

      const previous = accumulator[index - 1] ?? value;
      const previousPrevious = accumulator[index - 2] ?? value;
      const output =
        value -
        2 * cosine * previousPrevious +
        previous -
        (-2 * r * cosine * previous) -
        r * r * previousPrevious;

      accumulator.push(output);
      return accumulator;
    }, []);
  }

  return {
    ...signal,
    values: filteredValues,
  };
}

export function detectRPeaks(values: number[], samplingRate: number): number[] {
  if (values.length < 5) {
    return [];
  }

  const smoothed = movingAverage(values, Math.max(5, Math.round(samplingRate / 50)));
  const median = medianValue(smoothed);
  const mad = medianAbsoluteDeviation(smoothed);
  const threshold = median + Math.max(0.5, 3 * mad);

  const minDistance = Math.max(12, Math.round(samplingRate * 0.28));
  const peaks: number[] = [];

  smoothed.forEach((value, index) => {
    const left = smoothed[index - 1] ?? -Infinity;
    const right = smoothed[index + 1] ?? -Infinity;
    const isPeak = value > left && value >= right && value > threshold;

    if (isPeak && peaks.length === 0) {
      peaks.push(index);
      return;
    }

    if (isPeak && index - peaks[peaks.length - 1] >= minDistance) {
      peaks.push(index);
    }
  });

  return peaks;
}

function medianValue(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function medianAbsoluteDeviation(values: number[]): number {
  const median = medianValue(values);
  const deviations = values.map((value) => Math.abs(value - median));
  return medianValue(deviations);
}

export function computeMetrics(signal: SignalData, peaks: number[]): MetricSummary {
  if (!signal.values.length || !peaks.length) {
    return { bpm: 0, rrAverageMs: 0, beatCount: 0 };
  }

  const durationSeconds = signal.time[signal.time.length - 1] - signal.time[0];
  const bpm = durationSeconds > 0 ? (peaks.length / durationSeconds) * 60 : 0;
  const rrIntervalsMs = peaks
    .slice(1)
    .map((peak, index) => ((peak - peaks[index]) / signal.samplingRate) * 1000);
  const rrAverageMs = rrIntervalsMs.length ? rrIntervalsMs.reduce((sum, value) => sum + value, 0) / rrIntervalsMs.length : 0;

  return {
    bpm: Number(bpm.toFixed(1)),
    rrAverageMs: Number(rrAverageMs.toFixed(1)),
    beatCount: peaks.length,
  };
}

export function getEducationalContent(filterType: FilterType): EducationalContent {
  switch (filterType) {
    case "low-pass":
      return {
        title: "Filtro pasa bajas",
        description: "Suaviza la señal al reducir componentes de alta frecuencia que suelen corresponder a ruido y artefactos.",
        why: "Se usa para destacar tendencias generales y disminuir interferencias rápidas en la señal.",
        physiology: "Permite observar mejor el contorno general del ritmo cardíaco y distinguir cambios más lentos en la actividad eléctrica del corazón.",
      };
    case "high-pass":
      return {
        title: "Filtro pasa altas",
        description: "Resalta componentes de alta frecuencia y elimina componentes lentos que pueden sesgar el análisis.",
        why: "Ayuda a reducir la deriva basal y a enfatizar eventos rápidos como los complejos QRS.",
        physiology: "Facilita la identificación de los picos R y de cambios rápidos asociados a la despolarización ventricular.",
      };
    case "notch":
      return {
        title: "Filtro notch de 60 Hz",
        description: "Elimina una banda estrecha alrededor de 60 Hz para reducir interferencia eléctrica de línea.",
        why: "Se aplica para remover ruido de la red eléctrica que suele contaminar señales de baja amplitud.",
        physiology: "Mejora la calidad de la señal para observar con mayor claridad las morfologías cardíacas y los intervalos entre latidos.",
      };
    default:
      return {
        title: "Señal original",
        description: "La señal aún no ha sido procesada; sirve como referencia para comparar el efecto de cada filtro.",
        why: "Compara la señal cruda con la filtrada para entender cómo cambia el análisis.",
        physiology: "Permite reconocer el patrón basal del ECG y evaluar si las alteraciones observadas son reales o producto de artefactos.",
      };
  }
}
