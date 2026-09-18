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
import { ClinicalDisclaimer } from "@/components/ClinicalDisclaimer/ClinicalDisclaimer";
import { AutomaticInterpretationCard } from "@/components/LaboratorioVirtual/AutomaticInterpretationCard";
import { AnalysisResultsPanel } from "@/components/LaboratorioVirtual/AnalysisResultsPanel";
import {
  computeEmgFeatures,
  computeRmsEnvelope,
  detectContractions,
  rectifySignal,
  type EmgFeatures,
  type FilterType,
  type SignalData,
} from "@/components/LaboratorioVirtual/signal-utils";

/**
 * Presenta los descriptores EMG del nucleo de procesamiento con sus unidades.
 * Los registros estan expresados en milivoltios, de modo que RMS y MAV quedan
 * en mV, la varianza en mV^2 y la energia en mV^2*muestra; esta ultima es
 * proporcional a la duracion y solo comparable entre segmentos iguales.
 */
function formatEmgFeatures({ rms, mav, variance, energy }: EmgFeatures) {
  return [
    { label: "RMS", value: `${rms.toFixed(3)} mV` },
    { label: "MAV", value: `${mav.toFixed(3)} mV` },
    { label: "Varianza", value: `${variance.toFixed(4)} mV²` },
    { label: "Energía", value: `${energy.toFixed(1)} mV²·muestra` },
  ];
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

    // Misma cadena que se describe y valida en el articulo: rectificado,
    // envolvente RMS centrada y segmentacion con umbral robusto.
    const rectifiedValues = rectifySignal(signal.values);
    const envelope = computeRmsEnvelope(rectifiedValues, signal.samplingRate);
    const nextProcessedSignal: SignalData = {
      ...signal,
      values: envelope,
      name: `${signal.name} (rectificada + envolvente RMS)`,
      source: "emg-processed",
      units: signal.units ?? "mV",
    };

    setFilteredSignal(nextProcessedSignal);
    // Los marcadores senalan el inicio de cada contraccion segmentada.
    setActivations(detectContractions(envelope, signal.samplingRate).map((c) => c.onset));
  }, [signal]);

  const overview = useMemo(() => {
    if (!signal) {
      return "Carga una señal EMG para comenzar a explorar la activación muscular.";
    }

    return `Señal cargada: ${signal.name} • ${signal.samples} muestras • ${signal.samplingRate} Hz`;
  }, [signal]);

  const features = useMemo(() => computeEmgFeatures(signal?.values ?? []), [signal]);
  const cards = useMemo(() => formatEmgFeatures(features), [features]);

  const interpretation = useMemo(() => {
    if (!signal) {
      return {
        highlight: "Esperando señal EMG válida para generar una interpretación.",
        description: "Carga un registro muscular para estimar el nivel de actividad y el grado de esfuerzo asociado.",
        details: ["Se evaluarán RMS, MAV y amplitud de la señal."],
      };
    }

    const rmsValue = features.rms;
    const mavValue = features.mav;

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
  }, [features, signal]);

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

        <ClinicalDisclaimer />

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
