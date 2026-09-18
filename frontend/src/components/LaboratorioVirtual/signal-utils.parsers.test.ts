// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { parseCsvSignal, parseEdfSignal, parseWfdbSignal } from "./signal-utils";

function csvFile(content: string, name = "signal.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("parseCsvSignal", () => {
  it("lee una señal delimitada por comas con cabecera", async () => {
    const signal = await parseCsvSignal(
      csvFile("time,ecg\n0,0.1\n0.004,0.2\n0.008,0.15\n0.012,0.3\n"),
    );

    expect(signal.values).toEqual([0.1, 0.2, 0.15, 0.3]);
    expect(signal.source).toBe("csv");
    expect(signal.samples).toBe(4);
  });

  it("estima la frecuencia de muestreo a partir de la columna de tiempo", async () => {
    const rows = Array.from(
      { length: 20 },
      (_, index) => `${(index * 0.004).toFixed(3)},${index}`,
    ).join("\n");
    const signal = await parseCsvSignal(csvFile(`time,ecg\n${rows}\n`));

    expect(signal.samplingRate).toBe(250);
  });

  it("detecta el punto y coma como delimitador", async () => {
    const signal = await parseCsvSignal(csvFile("time;ecg\n0;1\n0.01;2\n0.02;3\n"));

    expect(signal.values).toEqual([1, 2, 3]);
    expect(signal.samplingRate).toBe(100);
  });

  it("acepta la coma decimal", async () => {
    const signal = await parseCsvSignal(csvFile("time;ecg\n0;1,5\n0,01;2,5\n0,02;3,5\n"));

    expect(signal.values).toEqual([1.5, 2.5, 3.5]);
  });

  it("conserva los canales adicionales de un registro multicanal", async () => {
    const signal = await parseCsvSignal(csvFile("time,c1,c2\n0,1,10\n0.01,2,20\n0.02,3,30\n"));

    expect(signal.channels).toHaveLength(2);
    expect(signal.channels?.[1]).toEqual([10, 20, 30]);
  });

  it("recurre a la frecuencia por defecto sin columna de tiempo", async () => {
    const signal = await parseCsvSignal(csvFile("1\n2\n3\n4\n"));

    expect(signal.samplingRate).toBe(250);
  });

  it("rechaza un archivo vacío", async () => {
    await expect(parseCsvSignal(csvFile(""))).rejects.toThrow();
  });

  it("rechaza un archivo sin valores numéricos", async () => {
    await expect(parseCsvSignal(csvFile("alpha,beta\ngamma,delta\n"))).rejects.toThrow();
  });
});

describe("parseWfdbSignal", () => {
  /**
   * Formato 212: cada 3 bytes codifican 2 muestras de 12 bits en complemento a
   * dos, y la cabecera declara "gain(baseline)/units" para pasar a unidades
   * fisicas mediante (cuentas - baseline) / gain.
   *
   * Empaquetado segun signal(5): byte0 = 8 bits bajos de la muestra 1;
   * byte1 = (4 bits altos de la muestra 2) << 4 | (4 bits altos de la muestra 1);
   * byte2 = 8 bits bajos de la muestra 2.
   *   [0x00, 0x54, 0x80] -> cuentas 0x400 = 1024 y 0x580 = 1408
   *   [0x11, 0x54, 0x00] -> cuentas 0x411 = 1041 y 0x500 = 1280
   * Con gain 200 y baseline 1024: 0 mV, 1.92 mV, 0.085 mV y 1.28 mV.
   */
  const DATA_BYTES = new Uint8Array([0x00, 0x54, 0x80, 0x11, 0x54, 0x00]);

  it("sigue el orden de nibbles de la especificación 212", async () => {
    // 0x123 y 0x456 se distinguen de cualquier permutacion de nibbles;
    // 0xfff y 0x800 comprueban el signo (-1 y -2048).
    const header = new File(["t 1 360 4\nt.dat 212 1(0)/mV 12 0 0 0 0 X\n"], "t.hea");
    const dat = new File([new Uint8Array([0x23, 0x41, 0x56, 0xff, 0x8f, 0x00])], "t.dat");

    const signal = await parseWfdbSignal(dat, header);

    expect(signal.values).toEqual([0x123, 0x456, -1, -2048]);
  });

  it("convierte las cuentas ADC a unidades físicas con gain y baseline", async () => {
    const header = new File(
      ["testrec 1 360 4\ntestrec.dat 212 200(1024)/mV 11 1024 0 0 0 MLII\n"],
      "testrec.hea",
    );
    const dat = new File([DATA_BYTES], "testrec.dat");

    const signal = await parseWfdbSignal(dat, header);

    expect(signal.values[0]).toBeCloseTo(0, 6);
    expect(signal.values[1]).toBeCloseTo(1.92, 6);
    expect(signal.values[2]).toBeCloseTo(0.085, 6);
    expect(signal.values[3]).toBeCloseTo(1.28, 6);
    expect(signal.units).toBe("mV");
    expect(signal.source).toBe("wfdb");
  });

  it("usa el ADC zero como línea base cuando la cabecera no la declara", async () => {
    const header = new File(
      ["testrec 1 360 4\ntestrec.dat 212 200/mV 11 1024 0 0 0 MLII\n"],
      "testrec.hea",
    );
    const dat = new File([DATA_BYTES], "testrec.dat");

    const signal = await parseWfdbSignal(dat, header);

    expect(signal.values[1]).toBeCloseTo(1.92, 6);
  });

  it("separa los canales intercalados de un registro multicanal", async () => {
    const header = new File(
      [
        "testrec 2 360 2\n" +
          "testrec.dat 212 200(1024)/mV 11 1024 0 0 0 MLII\n" +
          "testrec.dat 212 200(1024)/mV 11 1024 0 0 0 V5\n",
      ],
      "testrec.hea",
    );
    const dat = new File([DATA_BYTES], "testrec.dat");

    const signal = await parseWfdbSignal(dat, header);

    expect(signal.channelNames).toEqual(["MLII", "V5"]);
    expect(signal.channels?.[0][0]).toBeCloseTo(0, 6);
    expect(signal.channels?.[0][1]).toBeCloseTo(0.085, 6);
    expect(signal.channels?.[1][0]).toBeCloseTo(1.92, 6);
    expect(signal.channels?.[1][1]).toBeCloseTo(1.28, 6);
  });

  it("conserva cuentas ADC y unidades arbitrarias si la señal no está calibrada", async () => {
    const header = new File(
      ["testrec 1 360 4\ntestrec.dat 212 0 11 1024 0 0 0 MLII\n"],
      "testrec.hea",
    );
    const dat = new File([DATA_BYTES], "testrec.dat");

    const signal = await parseWfdbSignal(dat, header);

    expect(signal.values).toEqual([0, 384, 17, 256]);
    expect(signal.units).toBe("u.a.");
  });

  it("lee la frecuencia de muestreo de la cabecera", async () => {
    const header = new File(
      ["testrec 1 360 4\ntestrec.dat 212 200(1024)/mV 11 1024 0 0 0 MLII\n"],
      "testrec.hea",
    );
    const dat = new File([DATA_BYTES], "testrec.dat");

    const signal = await parseWfdbSignal(dat, header);

    expect(signal.samplingRate).toBe(360);
  });

  it("trunca al número de muestras declarado en la cabecera", async () => {
    const header = new File(
      ["testrec 1 360 3\ntestrec.dat 212 200(1024)/mV 11 1024 0 0 0 MLII\n"],
      "testrec.hea",
    );
    const dat = new File([DATA_BYTES], "testrec.dat");

    const signal = await parseWfdbSignal(dat, header);

    expect(signal.values).toHaveLength(3);
    expect(signal.time).toHaveLength(3);
  });

  it("construye el eje temporal a partir de la frecuencia de muestreo", async () => {
    const header = new File(
      ["testrec 1 100 4\ntestrec.dat 212 200(1024)/mV 11 1024 0 0 0 MLII\n"],
      "testrec.hea",
    );
    const dat = new File([DATA_BYTES], "testrec.dat");

    const signal = await parseWfdbSignal(dat, header);

    expect(signal.time).toEqual([0, 0.01, 0.02, 0.03]);
  });

  it("rechaza una cabecera vacía", async () => {
    const header = new File([""], "empty.hea");
    const dat = new File([new Uint8Array([0x40, 0x05, 0x80])], "empty.dat");

    await expect(parseWfdbSignal(dat, header)).rejects.toThrow();
  });
});

describe("parseEdfSignal", () => {
  const pad = (value: string | number, width: number) => String(value).padEnd(width, " ").slice(0, width);

  /**
   * EDF+ minimo: una senal de datos (4 muestras por registro de 1 s) y el canal
   * de anotaciones, que el lector debe descartar.
   */
  function edfFile(records: number[][]): File {
    const specs = [
      { label: "Oz.", dim: "uV", pmin: -100, pmax: 100, dmin: -1000, dmax: 1000, spr: 4 },
      { label: "EDF Annotations", dim: "", pmin: -1, pmax: 1, dmin: -32768, dmax: 32767, spr: 2 },
    ];
    const ns = specs.length;
    const headerBytes = 256 + ns * 256;
    let header =
      pad("0", 8) + pad("X", 80) + pad("X", 80) + pad("01.01.01", 8) + pad("00.00.00", 8) +
      pad(headerBytes, 8) + pad("EDF+C", 44) + pad(records.length, 8) + pad(1, 8) + pad(ns, 4);
    const columns: Array<[keyof (typeof specs)[number] | null, number]> = [
      ["label", 16], [null, 80], ["dim", 8], ["pmin", 8], ["pmax", 8],
      ["dmin", 8], ["dmax", 8], [null, 80], ["spr", 8], [null, 32],
    ];
    for (const [key, width] of columns) {
      for (const spec of specs) header += pad(key ? spec[key] : "", width);
    }

    const perRecord = specs.reduce((sum, spec) => sum + spec.spr, 0);
    const bytes = new Uint8Array(headerBytes + records.length * perRecord * 2);
    for (let i = 0; i < header.length; i += 1) bytes[i] = header.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    records.forEach((samples, r) => {
      samples.forEach((value, k) => view.setInt16(headerBytes + (r * perRecord + k) * 2, value, true));
    });
    return new File([bytes], "S001R02.edf");
  }

  it("convierte a unidades fisicas y descarta el canal de anotaciones", async () => {
    const signal = await parseEdfSignal(edfFile([[0, 10, -10, 1000], [1, 2, 3, 4]]));

    expect(signal.samplingRate).toBe(4);
    expect(signal.samples).toBe(8);
    expect(signal.units).toBe("µV");
    expect(signal.channels).toBeUndefined();
    const expected = [0, 1, -1, 100, 0.1, 0.2, 0.3, 0.4];
    signal.values.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 9));
  });

  it("rechaza una cabecera invalida", async () => {
    await expect(parseEdfSignal(new File([new Uint8Array(300)], "roto.edf"))).rejects.toThrow();
  });
});
