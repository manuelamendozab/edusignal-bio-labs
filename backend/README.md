# Backend

Esta carpeta está reservada para el backend del proyecto.

## Conversor de registros PhysioNet a CSV

Puedes convertir un registro ECG de PhysioNet en un archivo CSV con la siguiente instrucción:

```bash
python3 backend/scripts/convert_physionet_to_csv.py <ruta_del_registro> <archivo_csv_salida>
```

Ejemplo:

```bash
python3 backend/scripts/convert_physionet_to_csv.py /path/to/mitdb/100 /tmp/100.csv
```

La función implementada cumple con los requisitos:
- usa wfdb para leer el registro,
- extrae el primer canal disponible de ECG (priorizando MLII),
- genera columnas time y ecg,
- guarda el resultado como CSV,
- imprime la frecuencia de muestreo, el número de muestras y la duración de la señal.
