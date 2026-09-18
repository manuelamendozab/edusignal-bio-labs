import { lazy, Suspense, useMemo } from "react";
import { ScanLine } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SignalData } from "@/components/LaboratorioVirtual/signal-utils";

const Plot = lazy(() => import("react-plotly.js"));

/**
 * Traza de Plotly, con los campos que usa este visor. `react-plotly.js` no
 * publica declaraciones de tipos, de modo que sin esta anotacion TypeScript
 * infiere el tipo del array a partir de su primer elemento y rechaza las trazas
 * posteriores, que llevan `dash` o `mode: "markers"`.
 */
type PlotTrace = {
  x: number[];
  y: number[];
  type: "scatter";
  mode: "lines" | "markers";
  name: string;
  line?: { color: string; width: number; dash?: string };
  marker?: { color: string; size: number; symbol: string };
  hovertemplate?: string;
};

type SignalViewerProps = {
  signal: SignalData | null;
  filteredSignal?: SignalData | null;
  peaks?: number[];
  title?: string;
  valueLabel?: string;
  valueUnit?: string;
  peakLabel?: string;
  emptyState?: string;
};

export function SignalViewer({
  signal,
  filteredSignal,
  peaks = [],
  title = "Visualización de la señal",
  valueLabel = "Amplitud",
  valueUnit = "mV",
  peakLabel = "Picos R",
  emptyState = "Sube un archivo CSV para visualizar la señal ECG.",
}: SignalViewerProps) {
  const plotData = useMemo(() => {
    if (!signal) {
      return [];
    }

    const hoverTemplate = `%{y:.3f} ${valueUnit}<extra></extra>`;
    const baseTrace: PlotTrace = {
      x: signal.time,
      y: signal.values,
      type: "scatter" as const,
      mode: "lines" as const,
      name: "Señal original",
      line: { color: "#3b82f6", width: 2.4 },
      hovertemplate: hoverTemplate,
    };

    const traces: PlotTrace[] = [baseTrace];

    if (filteredSignal && filteredSignal.values.length) {
      traces.push({
        x: filteredSignal.time,
        y: filteredSignal.values,
        type: "scatter" as const,
        mode: "lines" as const,
        name: "Señal filtrada",
        line: { color: "#14b8a6", width: 2.2, dash: "dot" },
        hovertemplate: hoverTemplate,
      });
    }

    if (peaks.length) {
      const peakValues = peaks.map((peakIndex) => signal.values[peakIndex] ?? 0);
      traces.push({
        x: peaks.map((peakIndex) => signal.time[peakIndex] ?? 0),
        y: peakValues,
        type: "scatter" as const,
        mode: "markers" as const,
        name: peakLabel,
        marker: { color: "#f43f5e", size: 10, symbol: "circle" },
      });
    }

    return traces;
  }, [filteredSignal, peaks, peakLabel, signal, valueUnit]);

  return (
    <Card className="border-primary/10 bg-card/80 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScanLine className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>
          Zoom, paneo y restablecimiento del eje para explorar la señal con detalle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {signal ? (
          <div className="h-[430px] rounded-2xl border border-border/70 bg-background/70 p-2">
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Cargando visualización…</div>}>
              <Plot
                data={plotData}
                layout={{
                  autosize: true,
                  margin: { l: 45, r: 10, t: 30, b: 40 },
                  paper_bgcolor: "rgba(0,0,0,0)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                  dragmode: "zoom",
                  hovermode: "x",
                  xaxis: { title: "Tiempo (s)", showgrid: true, gridcolor: "rgba(15,23,42,0.08)" },
                  yaxis: { title: valueLabel, showgrid: true, gridcolor: "rgba(15,23,42,0.08)" },
                  legend: { orientation: "h", y: 1.1 },
                }}
                config={{ displayModeBar: true, responsive: true, scrollZoom: true }}
                style={{ width: "100%", height: "100%" }}
              />
            </Suspense>
          </div>
        ) : (
          <div className="flex h-[430px] items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-gradient-soft text-sm text-muted-foreground">
            {emptyState}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
