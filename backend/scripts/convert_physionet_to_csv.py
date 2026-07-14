from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import wfdb


def resolve_record_path(record_path: str) -> Path:
    path = Path(record_path).expanduser()

    if path.is_dir():
        hea_files = sorted(path.glob("*.hea"))
        if hea_files:
            return hea_files[0].with_suffix("")
        raise FileNotFoundError(f"No se encontró ningún archivo .hea en el directorio: {path}")

    if path.suffix == ".hea":
        return path.with_suffix("")

    if path.suffix == ".dat":
        return path.with_suffix("")

    if path.exists():
        return path

    parent = path.parent if path.parent != Path("") else Path(".")
    candidates = sorted(parent.glob(f"{path.name}*.hea"))
    if candidates:
        return candidates[0].with_suffix("")

    raise FileNotFoundError(f"No se encontró el registro PhysioNet: {record_path}")


def convert_physionet_to_csv(record_path: str, output_csv: str) -> str:
    """Convierte un registro PhysioNet (.dat/.hea) a un archivo CSV con columnas time y ecg."""
    record_prefix = resolve_record_path(record_path)
    output_path = Path(output_csv).expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    header = wfdb.rdheader(str(record_prefix))
    signal_names = [name.lower() for name in getattr(header, "sig_name", [])]

    preferred_channel_index: Optional[int] = None
    for index, name in enumerate(signal_names):
        if "mlii" in name:
            preferred_channel_index = index
            break

    channel_index = preferred_channel_index if preferred_channel_index is not None else 0

    record = wfdb.rdrecord(str(record_prefix), channels=[channel_index])
    signal = np.asarray(record.p_signal).reshape(-1)
    sampling_rate = float(record.fs)
    time = np.arange(len(signal)) / sampling_rate

    dataframe = pd.DataFrame({"time": time, "ecg": signal.astype(float)})
    dataframe.to_csv(output_path, index=False)

    print(f"Frecuencia de muestreo: {sampling_rate} Hz")
    print(f"Número de muestras: {len(signal)}")
    print(f"Duración de la señal: {len(signal) / sampling_rate:.3f} s")
    print(f"Archivo CSV guardado en: {output_path}")

    return str(output_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convierte un registro PhysioNet a CSV")
    parser.add_argument("record_path", help="Ruta del registro PhysioNet (.hea/.dat o directorio)")
    parser.add_argument("output_csv", help="Ruta del archivo CSV de salida")
    args = parser.parse_args()

    convert_physionet_to_csv(args.record_path, args.output_csv)
