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
  /** Intervalo RR medio en ms. Es el inverso de la FC, no una medida de variabilidad. */
  rrMeanMs: number;
  /** SDNN: desviacion estandar de los intervalos RR. Variabilidad global. */
  sdnnMs: number;
  /** RMSSD: raiz cuadratica media de las diferencias RR sucesivas. Variabilidad a corto plazo. */
  rmssdMs: number;
  /** pNN50: porcentaje de diferencias RR sucesivas mayores a 50 ms. */
  pnn50: number;
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

type WfdbSignalSpec = {
  format: number;
  /** Cuentas ADC por unidad fisica. 0 en la cabecera = senal no calibrada. */
  gain: number;
  /** Valor ADC que corresponde a 0 en unidades fisicas. */
  baseline: number;
  units: string;
  description: string;
};

/**
 * Campo 3 de una linea de senal WFDB: "gain(baseline)/units".
 * Ejemplos validos: "200", "200/mV", "200(0)/mV", "1000(-50)/uV".
 *
 * Si falta la linea base se usa el ADC zero (campo 5), tal como especifica el
 * formato WFDB. Si la ganancia es 0 la senal esta sin calibrar: se conserva en
 * cuentas ADC y se marca con unidades arbitrarias en lugar de inventar mV.
 */
function parseGainField(token: string | undefined, adcZero: number) {
  const fallback = { gain: 1, baseline: adcZero, units: "u.a." };

  if (!token) {
    return fallback;
  }

  const match = token.match(/^([-+]?[\d.]+(?:[eE][-+]?\d+)?)(?:\((-?\d+)\))?(?:\/(.+))?$/);
  if (!match) {
    return fallback;
  }

  const gain = Number.parseFloat(match[1]);
  const baseline = match[2] !== undefined ? Number.parseInt(match[2], 10) : adcZero;
  const units = match[3]?.trim() || "mV";

  if (!Number.isFinite(gain) || gain === 0) {
    return { gain: 1, baseline: Number.isFinite(baseline) ? baseline : adcZero, units: "u.a." };
  }

  return {
    gain,
    baseline: Number.isFinite(baseline) ? baseline : adcZero,
    units,
  };
}

function parseWfdbHeader(headerText: string) {
  const lines = headerText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (!lines.length) {
    throw new Error("El archivo .hea está vacío.");
  }

  // Linea de registro: "nombre nsig fs nsamp ..."
  const headerFields = lines[0].split(/\s+/);
  const signalCount = Number.parseInt(headerFields[1] ?? "1", 10);
  const samplingRate = Number.parseInt(headerFields[2] ?? "250", 10);
  const sampleCount = Number.parseInt(headerFields[3] ?? "0", 10);

  // Lineas de senal: "archivo formato gain(baseline)/units adcRes adcZero ..."
  const signals: WfdbSignalSpec[] = lines.slice(1).map((line, index) => {
    const parts = line.split(/\s+/);
    const format = Number.parseInt(parts[1] ?? "212", 10);
    const adcZero = Number.parseInt(parts[4] ?? "0", 10);
    const { gain, baseline, units } = parseGainField(parts[2], Number.isFinite(adcZero) ? adcZero : 0);

    return {
      format: Number.isFinite(format) ? format : 212,
      gain,
      baseline,
      units,
      description: parts.slice(8).join(" ") || `Canal ${index + 1}`,
    };
  });

  return {
    signalCount: Number.isFinite(signalCount) && signalCount > 0 ? signalCount : 1,
    samplingRate: Number.isFinite(samplingRate) ? samplingRate : 250,
    sampleCount: Number.isFinite(sampleCount) ? sampleCount : 0,
    signals,
  };
}

/**
 * Formato 212: cada 3 bytes codifican 2 muestras de 12 bits en complemento a
 * dos. Devuelve cuentas ADC crudas, sin desplazar por la linea base.
 */
function decodeWfdb212(bytes: Uint8Array): number[] {
  const values: number[] = [];
  const toSigned12 = (value: number) => (value & 0x800 ? value - 0x1000 : value);

  for (let index = 0; index + 2 < bytes.length; index += 3) {
    const firstByte = bytes[index];
    const secondByte = bytes[index + 1];
    const thirdByte = bytes[index + 2];

    // Especificacion WFDB (signal(5)): la primera muestra son los 12 bits bajos
    // del primer par de bytes, almacenado con el byte menos significativo
    // primero; la segunda toma los 4 bits altos de ese par y el tercer byte.
    const firstSample = (firstByte | ((secondByte & 0x0f) << 8)) & 0x0fff;
    const secondSample = (thirdByte | ((secondByte & 0xf0) << 4)) & 0x0fff;

    values.push(toSigned12(firstSample), toSigned12(secondSample));
  }

  return values;
}

/** Formato 16: complemento a dos de 16 bits, byte bajo primero (little endian). */
function decodeWfdb16(bytes: Uint8Array): number[] {
  const values: number[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  for (let index = 0; index + 1 < bytes.length; index += 2) {
    values.push(view.getInt16(index, true));
  }

  return values;
}

export async function parseWfdbSignal(datFile: File, headerFile: File): Promise<SignalData> {
  const [headerText, datBuffer] = await Promise.all([headerFile.text(), datFile.arrayBuffer()]);
  const header = parseWfdbHeader(headerText);
  const bytes = new Uint8Array(datBuffer);

  const format = header.signals[0]?.format ?? 212;
  const rawValues = format === 16 ? decodeWfdb16(bytes) : decodeWfdb212(bytes);

  // Las muestras de los N canales vienen intercaladas: c0[0], c1[0], c0[1], ...
  const channelCount = Math.max(1, Math.min(header.signalCount, header.signals.length || 1));
  const samplesPerChannel = Math.floor(rawValues.length / channelCount);
  const sampleCount =
    header.sampleCount > 0 ? Math.min(header.sampleCount, samplesPerChannel) : samplesPerChannel;

  /** Conversion a unidades fisicas: (cuentas - baseline) / gain. */
  const channels = Array.from({ length: channelCount }, (_, channelIndex) => {
    const spec = header.signals[channelIndex] ?? header.signals[0];
    const gain = spec?.gain ?? 1;
    const baseline = spec?.baseline ?? 0;

    return Array.from(
      { length: sampleCount },
      (_, sampleIndex) => (rawValues[sampleIndex * channelCount + channelIndex] - baseline) / gain,
    );
  });

  const channelNames = Array.from(
    { length: channelCount },
    (_, index) => header.signals[index]?.description || `Canal ${index + 1}`,
  );

  return {
    name: `${datFile.name} + ${headerFile.name}`,
    samples: sampleCount,
    samplingRate: header.samplingRate,
    time: Array.from({ length: sampleCount }, (_, index) => index / header.samplingRate),
    values: channels[0] ?? [],
    source: "wfdb",
    units: header.signals[0]?.units ?? "mV",
    channels: channelCount > 1 ? channels : undefined,
    channelNames: channelCount > 1 ? channelNames : undefined,
  };
}

/**
 * Lee un archivo EDF/EDF+: cabecera ASCII de 256 bytes, 256 bytes de cabecera
 * por senal y registros de datos con muestras int16 little-endian. Se omite el
 * canal "EDF Annotations" de EDF+ y cualquier canal con otra frecuencia de
 * muestreo que el primero, para que todos compartan eje temporal.
 */
export async function parseEdfSignal(file: File): Promise<SignalData> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder("ascii");
  const text = (offset: number, length: number) =>
    decoder.decode(bytes.subarray(offset, offset + length)).trim();

  if (bytes.length < 256) {
    throw new Error("El archivo EDF está incompleto.");
  }

  const headerBytes = Number.parseInt(text(184, 8), 10);
  const declaredRecords = Number.parseInt(text(236, 8), 10);
  const recordSeconds = Number.parseFloat(text(244, 8));
  const signalCount = Number.parseInt(text(252, 4), 10);

  if (![headerBytes, recordSeconds, signalCount].every(Number.isFinite) || signalCount <= 0 || recordSeconds <= 0) {
    throw new Error("La cabecera EDF no es válida.");
  }

  // Cada campo de la cabecera de senal ocupa un bloque contiguo para todas las senales.
  const field = (column: number, width: number, index: number) =>
    text(256 + signalCount * column + index * width, width);

  const specs = Array.from({ length: signalCount }, (_, index) => ({
    label: field(0, 16, index).replace(/\.+$/, ""),
    units: field(96, 8, index),
    physicalMin: Number.parseFloat(field(104, 8, index)),
    physicalMax: Number.parseFloat(field(112, 8, index)),
    digitalMin: Number.parseInt(field(120, 8, index), 10),
    digitalMax: Number.parseInt(field(128, 8, index), 10),
    samplesPerRecord: Number.parseInt(field(216, 8, index), 10),
  }));

  const samplesPerRecord = specs.reduce((sum, spec) => sum + spec.samplesPerRecord, 0);
  const records =
    declaredRecords > 0
      ? declaredRecords
      : Math.floor((bytes.length - headerBytes) / (2 * samplesPerRecord));

  const offsets = specs.map((_, index) =>
    specs.slice(0, index).reduce((sum, spec) => sum + spec.samplesPerRecord, 0),
  );

  const dataIndices = specs
    .map((spec, index) => ({ spec, index }))
    .filter(({ spec }) => spec.label !== "EDF Annotations");
  if (!dataIndices.length) {
    throw new Error("El archivo EDF no contiene señales.");
  }
  const referenceRate = dataIndices[0].spec.samplesPerRecord;
  const kept = dataIndices.filter(({ spec }) => spec.samplesPerRecord === referenceRate);

  const channels = kept.map(({ spec, index }) => {
    const scale = (spec.physicalMax - spec.physicalMin) / (spec.digitalMax - spec.digitalMin);
    const values = new Array<number>(records * spec.samplesPerRecord);
    for (let record = 0; record < records; record += 1) {
      const start = headerBytes + (record * samplesPerRecord + offsets[index]) * 2;
      for (let sample = 0; sample < spec.samplesPerRecord; sample += 1) {
        const digital = view.getInt16(start + sample * 2, true);
        values[record * spec.samplesPerRecord + sample] =
          spec.physicalMin + (digital - spec.digitalMin) * scale;
      }
    }
    return values;
  });

  const samplingRate = referenceRate / recordSeconds;
  const sampleCount = channels[0].length;
  const units = kept[0].spec.units.replace(/^uV$/i, "µV") || "u.a.";

  return {
    name: file.name,
    samples: sampleCount,
    samplingRate,
    time: Array.from({ length: sampleCount }, (_, index) => index / samplingRate),
    values: channels[0],
    source: "edf",
    units,
    channels: channels.length > 1 ? channels : undefined,
    channelNames: channels.length > 1 ? kept.map(({ spec }) => spec.label) : undefined,
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
        const headerIsText = headerLine.some((cell) =>
          /time|value|signal|ecg|eeg|channel|amplitude|voltage|mV|mv/i.test(cell),
        );
        const dataRows = headerIsText ? rows.slice(1) : rows;
        const numericRows = dataRows.filter((row) =>
          row.some((cell) => !Number.isNaN(parseNumber(cell))),
        );

        if (!numericRows.length) {
          throw new Error("No se pudieron encontrar valores numéricos en el archivo.");
        }

        const headers = headerIsText
          ? headerLine
          : numericRows[0].map((_, index) => `col${index + 1}`);
        const parsedRows = numericRows.map((row) => row.map((cell) => parseNumber(cell)));
        const columns = parsedRows[0].map((_, columnIndex) =>
          parsedRows.map((row) => row[columnIndex]),
        );
        const timeIndex = findColumnIndex(headers, [
          "time",
          "t",
          "sample",
          "samples",
          "index",
          "i",
        ]);

        let time: number[] = [];
        let channelColumns: number[][] = [];
        let channelNames: string[] = [];

        if (timeIndex !== null) {
          time = columns[timeIndex] ?? [];
          channelColumns = columns.filter((_, index) => index !== timeIndex);
          channelNames = headers
            .filter((_, index) => index !== timeIndex)
            .map((name, index) => name || `Canal ${index + 1}`);
        } else if (columns.length >= 2) {
          time = columns[0] ?? [];
          channelColumns = columns.slice(1);
          channelNames = headers.slice(1).map((name, index) => name || `Canal ${index + 1}`);
        } else {
          channelColumns = columns;
          channelNames = headers.map((name, index) => name || `Canal ${index + 1}`);
        }

        const cleanedTime = time.filter((value) => Number.isFinite(value));
        const cleanedChannels = channelColumns.map((column) =>
          column.filter((value) => Number.isFinite(value)),
        );
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
          time: alignedTime.length
            ? alignedTime
            : alignedValues.map((_, index) => index / DEFAULT_SAMPLING_RATE),
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

/** Limites del rango analizado: borde inferior de delta y superior de gamma, en Hz. */
export const EEG_ANALYSIS_MIN_HZ = 0.5;
export const EEG_ANALYSIS_MAX_HZ = 50;

/** Longitud del segmento de Welch, en segundos. */
export const WELCH_SEGMENT_SECONDS = 4;
/** Solapamiento entre segmentos consecutivos de Welch. */
export const WELCH_OVERLAP_RATIO = 0.5;

/** Ventana de Hann de longitud `length`. */
function hannWindow(length: number): number[] {
  if (length <= 1) return [1];
  return Array.from(
    { length },
    (_, index) => 0.5 * (1 - Math.cos((2 * Math.PI * index) / (length - 1))),
  );
}

/**
 * Densidad espectral de potencia de un solo segmento, unilateral y escalada
 * segun la convencion de Welch: |X[k]|^2 / (Fs * sum(w^2)), duplicando los
 * bins que no son DC ni Nyquist para conservar la potencia total.
 */
function segmentPsd(segment: number[], window: number[], samplingRate: number): number[] {
  const length = segment.length;
  const binCount = Math.floor(length / 2) + 1;
  const windowEnergy = window.reduce((sum, value) => sum + value * value, 0);
  const scale = 1 / (samplingRate * windowEnergy);
  const psd: number[] = new Array(binCount);

  for (let k = 0; k < binCount; k += 1) {
    let real = 0;
    let imaginary = 0;
    for (let n = 0; n < length; n += 1) {
      const angle = (-2 * Math.PI * k * n) / length;
      const sample = segment[n] * window[n];
      real += sample * Math.cos(angle);
      imaginary += sample * Math.sin(angle);
    }
    const magnitudeSquared = real * real + imaginary * imaginary;
    const oneSided = k === 0 || (length % 2 === 0 && k === binCount - 1) ? 1 : 2;
    psd[k] = oneSided * magnitudeSquared * scale;
  }

  return psd;
}

/**
 * Estima la densidad espectral de potencia con el metodo de Welch: la señal se
 * divide en segmentos solapados, cada uno se enventana con Hann y su
 * periodograma se promedia. Reduce la varianza del estimador frente a una DFT
 * unica sobre todo el registro, a costa de resolucion en frecuencia.
 *
 * Si la señal es mas corta que un segmento completo se usa como segmento unico,
 * de modo que el estimador degrada al periodograma enventanado clasico.
 */
export function computeSpectralAnalysis(signal: SignalData | null) {
  if (!signal?.values.length) {
    return {
      frequencies: [] as number[],
      powerSpectrum: [] as number[],
      bandPowers: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
      dominantFrequency: 0,
      segmentLength: 0,
      segmentCount: 0,
    };
  }

  const values = signal.values;
  const samplingRate = signal.samplingRate || DEFAULT_SAMPLING_RATE;

  const requested = Math.round(WELCH_SEGMENT_SECONDS * samplingRate);
  const segmentLength = Math.max(8, Math.min(requested, values.length));
  const step = Math.max(1, Math.round(segmentLength * (1 - WELCH_OVERLAP_RATIO)));
  const window = hannWindow(segmentLength);
  const binCount = Math.floor(segmentLength / 2) + 1;

  const accumulated = new Array(binCount).fill(0);
  let segmentCount = 0;
  for (let start = 0; start + segmentLength <= values.length; start += step) {
    const psd = segmentPsd(values.slice(start, start + segmentLength), window, samplingRate);
    for (let k = 0; k < binCount; k += 1) accumulated[k] += psd[k];
    segmentCount += 1;
  }

  const powerSpectrum = accumulated.map((value) => value / Math.max(1, segmentCount));
  const frequencies = Array.from(
    { length: binCount },
    (_, index) => (index * samplingRate) / segmentLength,
  );

  const bandPowers = {
    delta: sumBandPower(powerSpectrum, frequencies, 0.5, 4),
    theta: sumBandPower(powerSpectrum, frequencies, 4, 8),
    alpha: sumBandPower(powerSpectrum, frequencies, 8, 13),
    beta: sumBandPower(powerSpectrum, frequencies, 13, 30),
    gamma: sumBandPower(powerSpectrum, frequencies, 30, 50),
  };

  // La frecuencia dominante se busca solo en el rango que cubren las bandas.
  // Fuera de el quedan la componente continua y la deriva lenta, que dominan
  // el espectro de casi cualquier EEG real, y la interferencia de red a 50/60 Hz;
  // ninguna es un ritmo fisiologico.
  let dominantIndex = -1;
  frequencies.forEach((frequency, index) => {
    if (frequency < EEG_ANALYSIS_MIN_HZ || frequency >= EEG_ANALYSIS_MAX_HZ) return;
    if (dominantIndex < 0 || powerSpectrum[index] > powerSpectrum[dominantIndex]) {
      dominantIndex = index;
    }
  });

  return {
    frequencies,
    powerSpectrum,
    bandPowers,
    dominantFrequency: dominantIndex >= 0 ? frequencies[dominantIndex] : 0,
    segmentLength,
    segmentCount,
  };
}

function sumBandPower(
  powerSpectrum: number[],
  frequencies: number[],
  minFrequency: number,
  maxFrequency: number,
): number {
  // Integracion discreta: la PSD se multiplica por el ancho de bin para obtener potencia.
  const binWidth = frequencies.length > 1 ? frequencies[1] - frequencies[0] : 1;
  return powerSpectrum.reduce((sum, power, index) => {
    const frequency = frequencies[index];
    if (frequency >= minFrequency && frequency < maxFrequency) {
      return sum + power * binWidth;
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

export const LOW_PASS_CUTOFF_HZ = 20;
export const BASELINE_CUTOFF_HZ = 1;
export const BAND_PASS_UPPER_HZ = 40;
export const NOTCH_HZ = 60;
export const NOTCH_POLE_RADIUS = 0.995;

/**
 * Filtro IIR pasa bajas de primer orden:
 *   y[n] = alpha * y[n-1] + (1 - alpha) * x[n],  alpha = exp(-2*pi*fc/Fs)
 */
function firstOrderLowPass(values: number[], cutoffHz: number, sampleRate: number): number[] {
  const alpha = Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  const output: number[] = [];

  values.forEach((value, index) => {
    if (index === 0) {
      output.push(value);
      return;
    }

    output.push(alpha * output[index - 1] + (1 - alpha) * value);
  });

  return output;
}

/** Pasa altas complementario: y[n] = x[n] - LP_fc(x)[n]. */
function firstOrderHighPass(values: number[], cutoffHz: number, sampleRate: number): number[] {
  const baseline = firstOrderLowPass(values, cutoffHz, sampleRate);
  return values.map((value, index) => value - baseline[index]);
}

/**
 * Notch de segundo orden centrado en f0:
 *   y[n] = x[n] - 2cos(w0)x[n-1] + x[n-2] + 2r*cos(w0)y[n-1] - r^2*y[n-2]
 */
function notchFilter(
  values: number[],
  notchHz: number,
  radius: number,
  sampleRate: number,
): number[] {
  const omega = (2 * Math.PI * notchHz) / sampleRate;
  const cosine = Math.cos(omega);
  const output: number[] = [];

  values.forEach((value, index) => {
    if (index < 2) {
      output.push(value);
      return;
    }

    output.push(
      value -
        2 * cosine * values[index - 1] +
        values[index - 2] +
        2 * radius * cosine * output[index - 1] -
        radius * radius * output[index - 2],
    );
  });

  return output;
}

export function applySignalFilter(signal: SignalData, filterType: FilterType): SignalData {
  // Un filtro cuya frecuencia caracteristica alcanza Nyquist no es realizable:
  // la señal se devuelve sin modificar en lugar de producir un resultado espurio.
  if (filterType === "none" || !isFilterAdmissible(filterType, signal.samplingRate)) {
    return signal;
  }

  const values = signal.values;
  const sampleRate = signal.samplingRate;
  let filteredValues: number[] = [...values];

  if (filterType === "low-pass") {
    filteredValues = firstOrderLowPass(values, LOW_PASS_CUTOFF_HZ, sampleRate);
  }

  if (filterType === "high-pass") {
    filteredValues = firstOrderHighPass(values, BASELINE_CUTOFF_HZ, sampleRate);
  }

  if (filterType === "band-pass") {
    const withoutBaseline = firstOrderHighPass(values, BASELINE_CUTOFF_HZ, sampleRate);
    filteredValues = firstOrderLowPass(withoutBaseline, BAND_PASS_UPPER_HZ, sampleRate);
  }

  if (filterType === "notch") {
    filteredValues = notchFilter(values, NOTCH_HZ, NOTCH_POLE_RADIUS, sampleRate);
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

const EMPTY_METRICS: MetricSummary = {
  bpm: 0,
  rrMeanMs: 0,
  sdnnMs: 0,
  rmssdMs: 0,
  pnn50: 0,
  beatCount: 0,
};

/**
 * Metricas de ritmo y variabilidad de la frecuencia cardiaca (HRV) en el
 * dominio del tiempo, sobre la serie de intervalos RR:
 *
 *   SDNN   = sqrt( 1/(N-1) * sum (RR_i - RR_media)^2 )
 *   RMSSD  = sqrt( 1/(N-1) * sum (RR_{i+1} - RR_i)^2 )
 *   pNN50  = 100 * #{ |RR_{i+1} - RR_i| > 50 ms } / (N-1)
 *
 * SDNN y RMSSD requieren al menos dos intervalos RR, es decir tres latidos.
 */
export function computeMetrics(signal: SignalData, peaks: number[]): MetricSummary {
  if (!signal.values.length || !peaks.length) {
    return { ...EMPTY_METRICS };
  }

  const durationSeconds = signal.time[signal.time.length - 1] - signal.time[0];
  const bpm = durationSeconds > 0 ? (peaks.length / durationSeconds) * 60 : 0;

  const rrIntervalsMs = peaks
    .slice(1)
    .map((peak, index) => ((peak - peaks[index]) / signal.samplingRate) * 1000);

  if (!rrIntervalsMs.length) {
    return { ...EMPTY_METRICS, bpm: Number(bpm.toFixed(1)), beatCount: peaks.length };
  }

  const rrMeanMs =
    rrIntervalsMs.reduce((sum, value) => sum + value, 0) / rrIntervalsMs.length;

  // Diferencias entre intervalos RR consecutivos, base de RMSSD y pNN50.
  const successiveDiffs = rrIntervalsMs
    .slice(1)
    .map((interval, index) => interval - rrIntervalsMs[index]);

  const sdnnMs =
    rrIntervalsMs.length > 1
      ? Math.sqrt(
          rrIntervalsMs.reduce((sum, value) => sum + (value - rrMeanMs) ** 2, 0) /
            (rrIntervalsMs.length - 1),
        )
      : 0;

  const rmssdMs = successiveDiffs.length
    ? Math.sqrt(
        successiveDiffs.reduce((sum, value) => sum + value ** 2, 0) / successiveDiffs.length,
      )
    : 0;

  const pnn50 = successiveDiffs.length
    ? (successiveDiffs.filter((value) => Math.abs(value) > 50).length / successiveDiffs.length) * 100
    : 0;

  return {
    bpm: Number(bpm.toFixed(1)),
    rrMeanMs: Number(rrMeanMs.toFixed(1)),
    sdnnMs: Number(sdnnMs.toFixed(1)),
    rmssdMs: Number(rmssdMs.toFixed(1)),
    pnn50: Number(pnn50.toFixed(1)),
    beatCount: peaks.length,
  };
}

export function getEducationalContent(filterType: FilterType): EducationalContent {
  switch (filterType) {
    case "low-pass":
      return {
        title: "Filtro pasa bajas",
        description:
          "Suaviza la señal al reducir componentes de alta frecuencia que suelen corresponder a ruido y artefactos.",
        why: "Se usa para destacar tendencias generales y disminuir interferencias rápidas en la señal.",
        physiology:
          "Permite observar mejor el contorno general del ritmo cardíaco y distinguir cambios más lentos en la actividad eléctrica del corazón.",
      };
    case "high-pass":
      return {
        title: "Filtro pasa altas",
        description:
          "Resalta componentes de alta frecuencia y elimina componentes lentos que pueden sesgar el análisis.",
        why: "Ayuda a reducir la deriva basal y a enfatizar eventos rápidos como los complejos QRS.",
        physiology:
          "Facilita la identificación de los picos R y de cambios rápidos asociados a la despolarización ventricular.",
      };
    case "notch":
      return {
        title: "Filtro notch de 60 Hz",
        description:
          "Elimina una banda estrecha alrededor de 60 Hz para reducir interferencia eléctrica de línea.",
        why: "Se aplica para remover ruido de la red eléctrica que suele contaminar señales de baja amplitud.",
        physiology:
          "Mejora la calidad de la señal para observar con mayor claridad las morfologías cardíacas y los intervalos entre latidos.",
      };
    default:
      return {
        title: "Señal original",
        description:
          "La señal aún no ha sido procesada; sirve como referencia para comparar el efecto de cada filtro.",
        why: "Compara la señal cruda con la filtrada para entender cómo cambia el análisis.",
        physiology:
          "Permite reconocer el patrón basal del ECG y evaluar si las alteraciones observadas son reales o producto de artefactos.",
      };
  }
}

/** Rectificado de onda completa: xr[n] = |x[n]|. Primera etapa de la cadena EMG. */
export function rectifySignal(values: number[]): number[] {
  return values.map((value) => Math.abs(value));
}

export type EmgFeatures = {
  /** Valor eficaz de la señal rectificada, en las unidades del registro (mV). */
  rms: number;
  /** Mean Absolute Value: media de |xr|, en las unidades del registro (mV). */
  mav: number;
  /** Varianza de la señal rectificada respecto a su propia media, en mV^2. */
  variance: number;
  /** Energia total, suma de cuadrados, en mV^2*muestra. */
  energy: number;
};

/**
 * Descriptores globales de amplitud y energia del EMG, calculados sobre la
 * señal rectificada xr[n] = |x[n]|:
 *
 *   RMS      = sqrt( 1/N * sum xr[n]^2 )
 *   MAV      = 1/N * sum |xr[n]|
 *   varianza = 1/N * sum (xr[n] - media(xr))^2
 *   energia  = sum xr[n]^2
 *
 * No se aplica normalizacion de amplitud (por ejemplo a una contraccion
 * voluntaria maxima), de modo que los valores no son comparables entre sujetos
 * ni entre electrodos. La energia es proporcional a la longitud del segmento y
 * solo es comparable entre segmentos de igual duracion.
 */
export function computeEmgFeatures(values: number[]): EmgFeatures {
  if (!values.length) {
    return { rms: 0, mav: 0, variance: 0, energy: 0 };
  }

  const rectified = rectifySignal(values);
  const count = rectified.length;
  const energy = rectified.reduce((sum, value) => sum + value * value, 0);
  const mav = rectified.reduce((sum, value) => sum + value, 0) / count;
  const variance =
    rectified.reduce((sum, value) => sum + (value - mav) * (value - mav), 0) / count;

  return { rms: Math.sqrt(energy / count), mav, variance, energy };
}

/** Longitud de la ventana RMS del envolvente EMG, en milisegundos. */
export const EMG_RMS_WINDOW_MS = 100;
/**
 * Duracion minima admisible de una contraccion, medida sobre la envolvente y en
 * milisegundos. La ventana RMS ensancha cada evento en aproximadamente su propia
 * longitud, de modo que este umbral rechaza eventos reales de menos de
 * EMG_MIN_CONTRACTION_MS - EMG_RMS_WINDOW_MS, es decir, 100 ms con los valores
 * por defecto. Fijarlo igual a la ventana lo convertiria en codigo muerto.
 */
export const EMG_MIN_CONTRACTION_MS = 200;
/** Multiplicador de la desviacion absoluta mediana en el umbral de activacion. */
export const EMG_MAD_MULTIPLIER = 2.5;
/**
 * Suelo del umbral, expresado como fraccion de la mediana de la envolvente.
 * Es relativo y no absoluto: un suelo fijo en mV depende de la ganancia del
 * equipo y del tipo de electrodo, y suprimia toda deteccion en registros de
 * aguja, cuya envolvente es un orden de magnitud menor que la de superficie.
 */
export const EMG_THRESHOLD_FLOOR_RATIO = 0.25;

export type Contraction = {
  /** Indice de muestra del inicio de la contraccion. */
  onset: number;
  /** Indice de muestra del final de la contraccion. */
  offset: number;
  /** Duracion en segundos. */
  durationSeconds: number;
};

/**
 * Envolvente RMS por ventana deslizante centrada de `EMG_RMS_WINDOW_MS`,
 * evaluada muestra a muestra (paso de 1, solapamiento maximo). Se centra la
 * ventana porque el analisis es offline: una ventana causal introduciria un
 * retardo sistematico del orden de su longitud en el instante de fin detectado.
 */
export function computeRmsEnvelope(values: number[], samplingRate: number): number[] {
  if (!values.length) return [];
  const size = Math.max(3, Math.round((EMG_RMS_WINDOW_MS / 1000) * samplingRate));
  const radius = Math.floor(size / 2);
  const envelope = new Array(values.length).fill(0);

  // Suma acumulada de cuadrados para evaluar cada ventana en tiempo constante.
  const prefix = new Array(values.length + 1).fill(0);
  for (let i = 0; i < values.length; i += 1) prefix[i + 1] = prefix[i] + values[i] * values[i];

  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - radius);
    const end = Math.min(values.length, i + radius + 1);
    envelope[i] = Math.sqrt((prefix[end] - prefix[start]) / (end - start));
  }

  return envelope;
}

/**
 * Segmenta contracciones sobre la envolvente RMS mediante umbral robusto
 * mediana + k*MAD. A diferencia del prototipo, que solo marcaba los cruces
 * ascendentes, aqui se emparejan inicio y fin y se descartan los episodios mas
 * cortos que `EMG_MIN_CONTRACTION_MS`, que corresponden a artefactos.
 */
export function detectContractions(envelope: number[], samplingRate: number): Contraction[] {
  if (!envelope.length) return [];

  const median = medianOf(envelope);
  const mad = medianOf(envelope.map((value) => Math.abs(value - median)));
  const threshold =
    median + Math.max(EMG_MAD_MULTIPLIER * mad, EMG_THRESHOLD_FLOOR_RATIO * median);
  const minSamples = Math.max(1, Math.round((EMG_MIN_CONTRACTION_MS / 1000) * samplingRate));

  const contractions: Contraction[] = [];
  let onset = -1;

  for (let index = 0; index < envelope.length; index += 1) {
    const active = envelope[index] > threshold;
    if (active && onset < 0) {
      onset = index;
    } else if (!active && onset >= 0) {
      if (index - onset >= minSamples) {
        contractions.push({ onset, offset: index - 1, durationSeconds: (index - onset) / samplingRate });
      }
      onset = -1;
    }
  }

  if (onset >= 0 && envelope.length - onset >= minSamples) {
    contractions.push({
      onset,
      offset: envelope.length - 1,
      durationSeconds: (envelope.length - onset) / samplingRate,
    });
  }

  return contractions;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export type Modality = "ecg" | "eeg" | "emg";

/** Frecuencia mas alta que cada filtro debe representar, en Hz. */
const FILTER_MAX_FREQUENCY_HZ: Record<Exclude<FilterType, "none">, number> = {
  "low-pass": LOW_PASS_CUTOFF_HZ,
  "high-pass": BASELINE_CUTOFF_HZ,
  "band-pass": BAND_PASS_UPPER_HZ,
  notch: NOTCH_HZ,
};

/**
 * Protocolo de filtrado de cada modalidad.
 * - ECG: las cinco opciones, disenadas para su banda util.
 * - EEG: se excluye el pasa bajas de 20 Hz, que suprimiria las bandas beta y
 *   gamma sobre las que se calcula la potencia.
 * - EMG: ningun filtro IIR. Las opciones estan pensadas para la banda del ECG y
 *   eliminarian el contenido del EMG (decenas a cientos de Hz); la cadena EMG
 *   se limita a rectificado y envolvente.
 */
export const FILTERS_BY_MODALITY: Record<Modality, FilterType[]> = {
  ecg: ["none", "high-pass", "low-pass", "band-pass", "notch"],
  eeg: ["none", "high-pass", "band-pass", "notch"],
  emg: ["none"],
};

/** Indica si un filtro es realizable a la frecuencia de muestreo dada (por debajo de Nyquist). */
export function isFilterAdmissible(filterType: FilterType, samplingRate: number): boolean {
  if (filterType === "none") return true;
  if (!Number.isFinite(samplingRate) || samplingRate <= 0) return false;
  return FILTER_MAX_FREQUENCY_HZ[filterType] < samplingRate / 2;
}
