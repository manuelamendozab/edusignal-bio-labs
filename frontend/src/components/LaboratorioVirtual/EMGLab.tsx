import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Flame, Sparkles, Zap, Dumbbell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EducationalPanel } from "@/components/EducationalPanel/EducationalPanel";
import { EventDetection } from "@/components/EventDetection/EventDetection";
import { MetricsPanel } from "@/components/MetricsPanel/MetricsPanel";
import { ProcessingPanel } from "@/components/ProcessingPanel/ProcessingPanel";
import { SignalUploader } from "@/components/SignalUploader/SignalUploader";
import { SignalViewer } from "@/components/SignalViewer/SignalViewer";
import { AutomaticInterpretationCard } from "@/components/LaboratorioVirtual/AutomaticInterpretationCard";
import { AnalysisResultsPanel } from "@/components/LaboratorioVirtual/AnalysisResultsPanel";
import {
  applySignalFilter,
  type FilterType,
  type SignalData,
} from "@/components/LaboratorioVirtual/signal-utils";

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

function rectifySignal(values: number[]): number[] {
  return values.map((value) => Math.abs(value));
}

function computeRmsSignal(values: number[], windowSize: number): number[] {
  if (!values.length) {
    return [];
  }

  const size = Math.max(3, Math.floor(windowSize));
  return values.map((_, index) => {
    const start = Math.max(0, index - size + 1);
    const slice = values.slice(start, index + 1);
    const meanSquare = slice.reduce((sum, value) => sum + value * value, 0) / slice.length;
    return Math.sqrt(meanSquare);
  });
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

function computeEmgMetrics(values: number[]) {
  if (!values.length) {
    return [
      { label: "RMS", value: "0.000" },
      { label: "MAV", value: "0.000" },
      { label: "Varianza", value: "0.000" },
      { label: "Energía", value: "0.000" },
    ];
  }

  const rectified = rectifySignal(values);
  const mean = rectified.reduce((sum, value) => sum + value, 0) / rectified.length;
  const rms = Math.sqrt(rectified.reduce((sum, value) => sum + value * value, 0) / rectified.length);
  const mav = rectified.reduce((sum, value) => sum + Math.abs(value), 0) / rectified.length;
  const variance = rectified.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / rectified.length;
  const energy = rectified.reduce((sum, value) => sum + value * value, 0);

  return [
    { label: "RMS", value: rms.toFixed(3) },
    { label: "MAV", value: mav.toFixed(3) },
    { label: "Varianza", value: variance.toFixed(3) },
    { label: "Energía", value: energy.toFixed(3) },
  ];
}

function detectMuscleActivations(values: number[], samplingRate: number): number[] {
  if (!values.length) return [];
  const smoothed = movingAverage(values.map((value) => Math.abs(value)), Math.max(5, Math.round(samplingRate / 50)));
  const median = medianValue(smoothed);
  const mad = medianAbsoluteDeviation(smoothed);
  const threshold = median + Math.max(0.1, 2.5 * mad);

  const detections: number[] = [];
  smoothed.forEach((value, index) => {
    if (value > threshold && (index === 0 || smoothed[index - 1] <= threshold)) {
      detections.push(index);
    }
  });
  return detections;
}

export function EMGLab() {
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [filteredSignal, setFilteredSignal] = useState<SignalData | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("none");
  const [activations, setActivations] = useState<number[]>([]);

  useEffect(() => {
    if (!signal) {
      setFilteredSignal(null);
      setActivations([]);
      return;
    }

    const rectifiedValues = rectifySignal(signal.values);
    const windowSize = Math.max(5, Math.round(signal.samplingRate / 50));
    const rmsSmoothedValues = computeRmsSignal(rectifiedValues, windowSize);
    const nextProcessedSignal: SignalData = {
      ...signal,
      values: rmsSmoothedValues,
      name: `${signal.name} (rectificada + RMS)`,
      source: "emg-processed",
      units: signal.units ?? "mV",
    };

    setFilteredSignal(nextProcessedSignal);
    setActivations(detectMuscleActivations(rmsSmoothedValues, signal.samplingRate));
  }, [activeFilter, signal]);

  const overview = useMemo(() => {
    if (!signal) {
      return "Carga una señal EMG para comenzar a explorar la activación muscular.";
    }

    return `Señal cargada: ${signal.name} • ${signal.samples} muestras • ${signal.samplingRate} Hz`;
  }, [signal]);

  const cards = useMemo(() => computeEmgMetrics(filteredSignal?.values ?? signal?.values ?? []), [filteredSignal, signal]);

  const interpretation = useMemo(() => {
    if (!signal) {
      return {
        highlight: "Esperando señal EMG válida para generar una interpretación.",
        description: "Carga un registro muscular para estimar el nivel de actividad y el grado de esfuerzo asociado.",
        details: ["Se evaluarán RMS, MAV y amplitud de la señal."],
      };
    }

    const rmsValue = Number.parseFloat(cards.find((card) => card.label === "RMS")?.value ?? "0");
    const mavValue = Number.parseFloat(cards.find((card) => card.label === "MAV")?.value ?? "0");

    if (rmsValue > 0.25 || mavValue > 0.2) {
      return {
        highlight: "Alta actividad muscular.",
        description: "La señal presenta una amplitud y energía elevadas, compatibles con contracción fuerte o esfuerzo sostenido.",
        details: ["RMS: " + rmsValue.toFixed(3), "MAV: " + mavValue.toFixed(3), "Se detectaron múltiples activaciones musculares."],
      };
    }

    if (rmsValue > 0.1 || mavValue > 0.08) {
      return {
        highlight: "Actividad muscular moderada.",
        description: "La señal muestra un nivel intermedio de activación muscular, consistente con esfuerzo ligero o mantenimiento de postura.",
        details: ["RMS: " + rmsValue.toFixed(3), "MAV: " + mavValue.toFixed(3), "Actividad muscular detectable pero no dominante."],
      };
    }

    return {
      highlight: "Baja actividad muscular.",
      description: "La señal presenta una amplitud reducida, lo que sugiere poca activación muscular o un registro de reposo.",
      details: ["RMS: " + rmsValue.toFixed(3), "MAV: " + mavValue.toFixed(3), "La actividad muscular es limitada."],
    };
  }, [cards, signal]);

  const educationalContent = {
    title: "Señal EMG",
    description: "La señal EMG refleja la actividad eléctrica de los músculos y se usa para evaluar contracciones y fatiga.",
    why: "Se observa la amplitud y la variabilidad de la señal para inferir la intensidad de la activación muscular.",
    physiology: "Un aumento sostenido del RMS y la energía muscular suele asociarse a mayor esfuerzo o fatiga muscular.",
  };

  const analysisMetrics = useMemo(
    () => Object.fromEntries(cards.map((card) => [card.label, card.value])),
    [cards],
  );

  const analysisResults = useMemo(
    () => ({ interpretation: `${interpretation.highlight}. ${interpretation.description}` }),
    [interpretation.description, interpretation.highlight],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 shadow-glow">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">Laboratorio Virtual</p>
              <p className="text-xs text-muted-foreground">EMG • activación muscular • análisis</p>
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
        <section className="rounded-[1.75rem] border border-primary/10 bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-glow sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-teal" />
                Módulo de bioseñales musculares
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Laboratorio Virtual para señales EMG</h1>
              <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
                Carga un archivo CSV, visualiza la actividad muscular, aplica filtros básicos y analiza métricas EMG adaptadas a la contracción.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Estado</p>
              <p className="mt-2 text-sm font-medium text-white">{overview}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <SignalUploader
              onSignalLoaded={setSignal}
              signal={signal}
              title="Carga una señal EMG"
              description="Sube un archivo CSV con valores de EMG para visualizar la actividad muscular y analizar sus métricas."
              signalType="emg"
            />
            <ProcessingPanel
              signal={signal}
              filteredSignal={filteredSignal}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              peaks={activations}
              title="Procesamiento EMG"
              description="Comparación entre la señal original y la versión rectificada y suavizada con RMS."
              showFilters={false}
            />
            <SignalViewer
              signal={signal}
              filteredSignal={filteredSignal}
              peaks={activations}
              title="Visualización de la señal EMG"
              valueLabel="Amplitud muscular"
              valueUnit="mV"
              peakLabel="Activaciones musculares"
              emptyState="Sube un archivo CSV para visualizar la señal EMG."
            />
          </div>

          <div className="space-y-6">
            <MetricsPanel
              metrics={null}
              title="Métricas EMG"
              description="Resumen cuantitativo de la activación muscular y la energía de la contracción."
              cards={cards.map((card) => ({ ...card, icon: card.label === "RMS" ? Activity : card.label === "MAV" ? Zap : card.label === "Varianza" ? Flame : Activity }))}
            />
            <AutomaticInterpretationCard
              icon={Dumbbell}
              title="Interpretación automática"
              subtitle="Nivel de actividad muscular estimado"
              tone="emg"
              highlight={interpretation.highlight}
              description={interpretation.description}
              details={interpretation.details}
            />
            <AnalysisResultsPanel
              labType="emg"
              signal={signal}
              metrics={analysisMetrics}
              results={analysisResults}
            />
            <EventDetection
              signal={signal}
              peaks={activations}
              title="Detección de activaciones musculares"
              description="Se señalan los momentos en los que la señal supera el umbral de contracción muscular."
              countLabel="Activaciones detectadas"
              emptyMessage="Carga una señal para iniciar el análisis muscular."
            />
            <EducationalPanel
              filterType={activeFilter}
              content={educationalContent}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
