import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, HeartPulse, Sparkles, Stethoscope, BrainCircuit } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EducationalPanel } from "@/components/EducationalPanel/EducationalPanel";
import { EventDetection } from "@/components/EventDetection/EventDetection";
import { MetricsPanel } from "@/components/MetricsPanel/MetricsPanel";
import { ProcessingPanel } from "@/components/ProcessingPanel/ProcessingPanel";
import { SignalUploader } from "@/components/SignalUploader/SignalUploader";
import { SignalViewer } from "@/components/SignalViewer/SignalViewer";
import { ClinicalDisclaimer } from "@/components/ClinicalDisclaimer/ClinicalDisclaimer";
import { AutomaticInterpretationCard } from "@/components/LaboratorioVirtual/AutomaticInterpretationCard";
import { AnalysisResultsPanel } from "@/components/LaboratorioVirtual/AnalysisResultsPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FILTERS_BY_MODALITY,
  applySignalFilter,
  computeMetrics,
  detectRPeaks,
  type FilterType,
  type MetricSummary,
  type SignalData,
} from "@/components/LaboratorioVirtual/signal-utils";

export function ECGLab() {
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [filteredSignal, setFilteredSignal] = useState<SignalData | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("none");
  const [peaks, setPeaks] = useState<number[]>([]);
  const [metrics, setMetrics] = useState<MetricSummary>({ bpm: 0, rrMeanMs: 0, sdnnMs: 0, rmssdMs: 0, pnn50: 0, beatCount: 0 });
  const [analysisState, setAnalysisState] = useState<{ status: "idle" | "loading" | "ready"; prediction?: string; confidence?: number; explanation?: string; model?: string }>({ status: "idle" });

  useEffect(() => {
    if (!signal) {
      setFilteredSignal(null);
      setPeaks([]);
      setMetrics({ bpm: 0, rrMeanMs: 0, sdnnMs: 0, rmssdMs: 0, pnn50: 0, beatCount: 0 });
      return;
    }

    const nextFilteredSignal = applySignalFilter(signal, activeFilter);
    setFilteredSignal(nextFilteredSignal);

    const nextPeaks = detectRPeaks(nextFilteredSignal.values, nextFilteredSignal.samplingRate);
    setPeaks(nextPeaks);
    setMetrics(computeMetrics(signal, nextPeaks));
  }, [activeFilter, signal]);

  const runIntelligentAnalysis = async () => {
    if (!signal) {
      setAnalysisState({ status: "idle" });
      return;
    }

    setAnalysisState({ status: "loading" });

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/ecg/intelligent-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          features: {
            bpm: metrics.bpm,
            rrMeanMs: metrics.rrMeanMs,
            sdnnMs: metrics.sdnnMs,
            rmssdMs: metrics.rmssdMs,
            pnn50: metrics.pnn50,
            qrsCount: metrics.beatCount,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo obtener la predicción");
      }

      const result = await response.json();
      setAnalysisState({
        status: "ready",
        prediction: result.prediction,
        confidence: result.confidence,
        explanation: result.explanation,
        model: result.model,
      });
    } catch (error) {
      setAnalysisState({
        status: "ready",
        prediction: "No disponible",
        explanation: "No se pudo completar la predicción en este momento.",
      });
    }
  };

  const overview = useMemo(() => {
    if (!signal) {
      return "Carga una señal ECG para empezar a explorar el laboratorio virtual.";
    }

    return `Señal cargada: ${signal.name} • ${signal.samples} muestras • ${signal.samplingRate} Hz`;
  }, [signal]);

  const interpretation = useMemo(() => {
    if (!signal || !metrics.bpm) {
      return {
        highlight: "Esperando señal ECG válida para generar una interpretación.",
        description: "Carga un archivo con suficiente calidad para evaluar la frecuencia cardíaca, la variabilidad y la presencia de complejos QRS.",
        details: ["Se analizará la frecuencia cardíaca y la regularidad del ritmo.", "Se revisará la cantidad de picos detectados."],
      };
    }

    if (metrics.bpm >= 100) {
      return {
        highlight: "Posible taquicardia.",
        description: "La frecuencia cardíaca observada es más alta que la esperada para un ritmo en reposo.",
        details: ["Frecuencia cardíaca: " + metrics.bpm.toFixed(1) + " bpm", "Picos detectados: " + metrics.beatCount, "RR medio: " + metrics.rrMeanMs.toFixed(1) + " ms", "SDNN: " + metrics.sdnnMs.toFixed(1) + " ms · RMSSD: " + metrics.rmssdMs.toFixed(1) + " ms"],
      };
    }

    if (metrics.bpm <= 50) {
      return {
        highlight: "Posible bradicardia.",
        description: "La frecuencia cardíaca observada es menor que la esperada para un ritmo en reposo.",
        details: ["Frecuencia cardíaca: " + metrics.bpm.toFixed(1) + " bpm", "Picos detectados: " + metrics.beatCount, "RR medio: " + metrics.rrMeanMs.toFixed(1) + " ms", "SDNN: " + metrics.sdnnMs.toFixed(1) + " ms · RMSSD: " + metrics.rmssdMs.toFixed(1) + " ms"],
      };
    }

    return {
      highlight: "Frecuencia cardíaca dentro de rango normal.",
      description: "El ritmo detectado se encuentra dentro del rango habitual y la señal presenta un patrón de latidos estable.",
      details: [
        "Frecuencia cardíaca: " + metrics.bpm.toFixed(1) + " bpm",
        "RR medio: " + metrics.rrMeanMs.toFixed(1) + " ms",
        "SDNN: " + metrics.sdnnMs.toFixed(1) + " ms · RMSSD: " + metrics.rmssdMs.toFixed(1) + " ms · pNN50: " + metrics.pnn50.toFixed(1) + " %",
        "QRS detectados: " + metrics.beatCount,
      ],
    };
  }, [metrics, signal]);

  const analysisMetrics = useMemo(
    () => ({
      "Frecuencia cardíaca (bpm)": Number.isFinite(metrics.bpm) ? metrics.bpm.toFixed(1) : "0.0",
      "RR medio (ms)": Number.isFinite(metrics.rrMeanMs) ? metrics.rrMeanMs.toFixed(1) : "0.0",
      "SDNN (ms)": Number.isFinite(metrics.sdnnMs) ? metrics.sdnnMs.toFixed(1) : "0.0",
      "RMSSD (ms)": Number.isFinite(metrics.rmssdMs) ? metrics.rmssdMs.toFixed(1) : "0.0",
      "pNN50 (%)": Number.isFinite(metrics.pnn50) ? metrics.pnn50.toFixed(1) : "0.0",
      "Latidos detectados": metrics.beatCount,
      "Filtro activo": activeFilter,
    }),
    [activeFilter, metrics.beatCount, metrics.bpm, metrics.pnn50, metrics.rmssdMs, metrics.rrMeanMs, metrics.sdnnMs],
  );

  const analysisResults = useMemo(
    () => ({
      interpretation: `${interpretation.highlight}. ${interpretation.description}`,
      intelligentPrediction: analysisState.prediction,
      intelligentConfidence: analysisState.confidence,
      intelligentExplanation: analysisState.explanation,
    }),
    [analysisState.confidence, analysisState.explanation, analysisState.prediction, interpretation.description, interpretation.highlight],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand shadow-glow">
              <HeartPulse className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">Laboratorio Virtual</p>
              <p className="text-xs text-muted-foreground">ECG • filtros • detección de picos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/laboratorio">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <Link to="/chat">
              <Button variant="outline" size="sm">
                Asistente
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[1.75rem] border border-primary/10 bg-gradient-hero p-6 text-white shadow-glow sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-teal" />
                Módulo principal de bioseñales
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Laboratorio Virtual para señales ECG</h1>
              <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
                Carga un archivo CSV, visualiza la señal, aplica filtros básicos, detecta picos R y analiza métricas cardíacas con contexto educativo.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Estado</p>
              <p className="mt-2 text-sm font-medium text-white">{overview}</p>
            </div>
          </div>
        </section>

        <ClinicalDisclaimer />

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <SignalUploader
              onSignalLoaded={setSignal}
              signal={signal}
              title="Carga una señal ECG"
              description="Sube un archivo CSV con valores de ECG para visualizarlo, filtrar y analizar."
              signalType="ecg"
            />
            <ProcessingPanel
              signal={signal}
              filteredSignal={filteredSignal}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              peaks={peaks}
              allowedFilters={FILTERS_BY_MODALITY.ecg}
            />
            <SignalViewer signal={signal} filteredSignal={filteredSignal} peaks={peaks} />
          </div>

          <div className="space-y-6">
            <MetricsPanel metrics={metrics} />
            <Card className="border-primary/10 bg-card/80 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  Análisis inteligente
                </CardTitle>
                <CardDescription>
                  El sistema extrae características ECG y las envía a un backend preparado para clasificar patrones y explicar el resultado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Estado</p>
                    <p className="text-sm text-muted-foreground">
                      {analysisState.status === "loading" ? "Clasificando…" : analysisState.status === "ready" ? "Listo para interpretar" : "Esperando señal ECG"}
                    </p>
                  </div>
                  <Button onClick={runIntelligentAnalysis} size="sm" disabled={!signal || analysisState.status === "loading"}>
                    {analysisState.status === "loading" ? "Analizando…" : "Analizar"}
                  </Button>
                </div>

                <div className={`rounded-2xl border p-4 ${analysisState.prediction === "Posible Arritmia" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${analysisState.prediction === "Posible Arritmia" ? "bg-amber-500" : "bg-emerald-500"}`} />
                    <p className="text-sm font-semibold">{analysisState.prediction ?? "Estado Normal"}</p>
                  </div>
                  <p className="mt-2 text-sm text-foreground/80">
                    {analysisState.explanation ?? "El modelo se ejecutará con las características ECG extraídas automáticamente y podrá sustituirse por un modelo entrenado más adelante."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>Confianza: {analysisState.confidence ? `${(analysisState.confidence * 100).toFixed(0)}%` : "—"}</span>
                    <span>Modelo: {analysisState.model ?? "rule-based-prototype"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <AutomaticInterpretationCard
              icon={Stethoscope}
              title="Interpretación automática"
              subtitle="Resumen orientativo guiado por métricas ECG"
              tone="ecg"
              highlight={interpretation.highlight}
              description={interpretation.description}
              details={interpretation.details}
            />
            <AnalysisResultsPanel
              labType="ecg"
              signal={signal}
              metrics={analysisMetrics}
              results={analysisResults}
            />
            <EventDetection signal={signal} peaks={peaks} />
            <EducationalPanel filterType={activeFilter} />
          </div>
        </div>
      </main>
    </div>
  );
}
