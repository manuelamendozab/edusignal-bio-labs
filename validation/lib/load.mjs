// Carga de registros con los lectores de produccion de la plataforma.
import { readFileSync } from "node:fs";
import { parseEdfSignal, parseWfdbSignal } from "../.build/signal-utils.mjs";

const asFile = (path) => new File([readFileSync(path)], path.split("/").pop());

export const loadWfdb = (dir, record) =>
  parseWfdbSignal(asFile(`${dir}/${record}.dat`), asFile(`${dir}/${record}.hea`));

export const loadEdf = (path) => parseEdfSignal(asFile(path));

/** Canal cuyo nombre cumple `pattern`; si no existe, el primero. */
export function pickChannel(signal, pattern) {
  if (!signal.channels) return { index: 0, values: signal.values };
  const found = signal.channelNames.findIndex((name) => pattern.test(name));
  const index = found >= 0 ? found : 0;
  return { index, values: signal.channels[index] };
}
