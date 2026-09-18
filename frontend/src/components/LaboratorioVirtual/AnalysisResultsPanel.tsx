import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SignalData } from "@/components/LaboratorioVirtual/signal-utils";

type LabType = "ecg" | "emg" | "eeg";

type AnalysisMetricValue = string | number | boolean | null | undefined;

type AnalysisResult = {
  id: string;
  signalType: LabType;
  signalName: string;
  date: string;
  durationSeconds: number;
  metrics: Record<string, AnalysisMetricValue>;
  results: {
    interpretation?: string;
    intelligentPrediction?: string;
    intelligentConfidence?: number;
    intelligentExplanation?: string;
  };
  signal?: SignalData;
};

type AnalysisResultsPanelProps = {
  labType: LabType;
  signal: SignalData | null;
  title?: string;
  description?: string;
  metrics?: Record<string, AnalysisMetricValue>;
  results?: AnalysisResult["results"];
};

function formatDate(dateValue: string) {
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0.0 s";
  }
  return `${seconds.toFixed(2)} s`;
}

function buildSignalSvg(signal?: SignalData) {
  if (!signal?.values?.length) {
    return "";
  }

  const width = 380;
  const height = 140;
  const values = signal.values.slice(0, 160);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 20) - 10;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8fafc"/><polyline fill="none" stroke="#4f46e5" stroke-width="2.5" points="${points}" /></svg>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function buildExportHtml(entries: AnalysisResult[]) {
  const reportEntries = entries
    .map((entry) => {
      const metricsHtml = Object.entries(entry.metrics)
        .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</li>`)
        .join("");

      const resultsHtml = [
        entry.results.interpretation ? `<li><strong>Interpretación:</strong> ${escapeHtml(entry.results.interpretation)}</li>` : "",
        entry.results.intelligentPrediction ? `<li><strong>Predicción inteligente:</strong> ${escapeHtml(entry.results.intelligentPrediction)}</li>` : "",
        entry.results.intelligentConfidence !== undefined ? `<li><strong>Confianza:</strong> ${(entry.results.intelligentConfidence * 100).toFixed(0)}%</li>` : "",
        entry.results.intelligentExplanation ? `<li><strong>Explicación:</strong> ${escapeHtml(entry.results.intelligentExplanation)}</li>` : "",
      ].filter(Boolean).join("");

      return `
        <section style="page-break-after: always; margin-bottom: 24px;">
          <h2>${escapeHtml(entry.signalName)}</h2>
          <p><strong>Tipo:</strong> ${escapeHtml(entry.signalType)} · <strong>Fecha:</strong> ${escapeHtml(formatDate(entry.date))} · <strong>Duración:</strong> ${escapeHtml(formatDuration(entry.durationSeconds))}</p>
          <div style="display: flex; gap: 16px; align-items: flex-start; margin: 12px 0;">
            <div>${buildSignalSvg(entry.signal)}</div>
            <div>
              <ul>${metricsHtml}</ul>
            </div>
          </div>
          <ul>${resultsHtml}</ul>
        </section>
      `;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Resultados de análisis</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#111827;}h1{margin-bottom:8px;}h2{margin-bottom:6px;}ul{padding-left:20px;}@media print{body{padding:0;}}</style></head><body><h1>Resultados del análisis</h1><p>Reporte exportado desde EduSignal.</p>${reportEntries}</body></html>`;
}

/**
 * Guarda el historial tolerando que `localStorage` se quede sin cuota o este
 * deshabilitado. Antes la escritura iba sin proteger, de modo que un
 * QuotaExceededError salia del efecto y el limite de error de React tumbaba el
 * laboratorio entero: el estudiante veia "This page didn't load" al cambiar de
 * canal. El historial es una comodidad, nunca un motivo para perder la sesion,
 * asi que ante un fallo se reintenta con menos entradas y, si aun asi no cabe,
 * se abandona en silencio.
 */
function persistHistory(storageKey: string, entries: AnalysisResult[]): void {
  for (const attempt of [entries, entries.slice(0, 4), entries.slice(0, 1)]) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(attempt));
      return;
    } catch {
      // Se prueba con un historial mas corto.
    }
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // localStorage no disponible (modo privado, cookies bloqueadas).
  }
}

export function AnalysisResultsPanel({
  labType,
  signal,
  title = "Resultados del Análisis",
  description = "Historial académico de las señales procesadas y sus métricas.",
  metrics = {},
  results = {},
}: AnalysisResultsPanelProps) {
  const storageKey = `edusignal-analysis-history-${labType}`;
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<AnalysisResult | null>(null);
  const lastSavedSignature = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AnalysisResult[];
        setHistory(parsed);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  const currentSignature = useMemo(() => {
    if (!signal?.values?.length) {
      return "";
    }

    return JSON.stringify({
      signalName: signal.name,
      samples: signal.samples,
      samplingRate: signal.samplingRate,
      metrics,
      results,
      values: signal.values.slice(0, 60),
      time: signal.time.slice(0, 60),
    });
  }, [metrics, results, signal]);

  useEffect(() => {
    if (!signal?.values?.length || !currentSignature || currentSignature === lastSavedSignature.current) {
      return;
    }

    const entry: AnalysisResult = {
      id: `${labType}-${Date.now()}`,
      signalType: labType,
      signalName: signal.name,
      date: new Date().toISOString(),
      durationSeconds: signal.time.length > 1 ? signal.time[signal.time.length - 1] - signal.time[0] : signal.samples / Math.max(signal.samplingRate, 1),
      metrics: Object.fromEntries(Object.entries(metrics).map(([label, value]) => [label, value])),
      results,
      // Solo los campos que el historial dibuja. Un `...signal` arrastraba
      // `channels`, que en un EDF de 64 derivaciones son varios millones de
      // muestras (unos 10 MB por entrada) que nadie lee: el historial unicamente
      // pinta `values` y `time`, ya recortados a 400 puntos.
      signal: {
        name: signal.name,
        samples: signal.samples,
        samplingRate: signal.samplingRate,
        source: signal.source,
        units: signal.units,
        values: signal.values.slice(0, Math.min(signal.values.length, 400)),
        time: signal.time.slice(0, Math.min(signal.time.length, 400)),
      },
    };

    const nextEntries = [entry, ...history.filter((item) => item.id !== entry.id)].slice(0, 12);
    setHistory(nextEntries);
    lastSavedSignature.current = currentSignature;

    if (typeof window !== "undefined") {
      persistHistory(storageKey, nextEntries);
    }
  }, [currentSignature, history, labType, metrics, results, signal, storageKey]);

  const exportResults = () => {
    if (!history.length) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      return;
    }

    printWindow.document.write(buildExportHtml(history));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <Card className="border-primary/10 bg-card/80 shadow-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={exportResults} disabled={!history.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Resultados
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length ? (
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Señal</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Resumen</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.signalName}</TableCell>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>{formatDuration(entry.durationSeconds)}</TableCell>
                    <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                      {entry.results.interpretation ?? entry.results.intelligentPrediction ?? "Análisis registrado"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedEntry(entry)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/20 bg-background/70 p-6 text-sm text-muted-foreground">
            Aún no hay resultados guardados. Procese una señal para construir el historial del laboratorio.
          </div>
        )}
      </CardContent>

      <Dialog open={Boolean(selectedEntry)} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEntry?.signalName ?? "Resultado del análisis"}</DialogTitle>
          </DialogHeader>
          {selectedEntry ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">{formatDate(selectedEntry.date)}</p>
                <p className="mt-2 text-sm">Duración: {formatDuration(selectedEntry.durationSeconds)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm font-semibold text-foreground">Métricas</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {Object.entries(selectedEntry.metrics).map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border/60 bg-card/70 p-3 text-sm">
                      <div className="text-muted-foreground">{label}</div>
                      <div className="mt-1 font-semibold text-foreground">{String(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm font-semibold text-foreground">Interpretación</p>
                <p className="mt-2 text-sm text-muted-foreground">{selectedEntry.results.interpretation ?? "Sin interpretación registrada."}</p>
                {selectedEntry.results.intelligentPrediction ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Predicción:</span> {selectedEntry.results.intelligentPrediction}
                  </p>
                ) : null}
                {selectedEntry.results.intelligentExplanation ? (
                  <p className="mt-2 text-sm text-muted-foreground">{selectedEntry.results.intelligentExplanation}</p>
                ) : null}
              </div>
              {selectedEntry.signal ? (
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Vista previa de la señal</p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-card/70 p-3">
                    <div dangerouslySetInnerHTML={{ __html: buildSignalSvg(selectedEntry.signal) }} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
