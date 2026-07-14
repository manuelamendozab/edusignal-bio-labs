import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, BrainCircuit, Clock3, Sparkles, Waves, Brain } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EducationalPanel } from "@/components/EducationalPanel/EducationalPanel";
import { MetricsPanel } from "@/components/MetricsPanel/MetricsPanel";
import { ProcessingPanel } from "@/components/ProcessingPanel/ProcessingPanel";
import { SignalUploader } from "@/components/SignalUploader/SignalUploader";
import { SignalViewer } from "@/components/SignalViewer/SignalViewer";
import { AutomaticInterpretationCard } from "@/components/LaboratorioVirtual/AutomaticInterpretationCard";
import { AnalysisResultsPanel } from "@/components/LaboratorioVirtual/AnalysisResultsPanel";
import {
  applySignalFilter,
  computeSpectralAnalysis,
  getSignalChannel,
  type FilterType,
  type SignalData,
} from "@/components/LaboratorioVirtual/signal-utils";

const Plot = lazy(() => import("react-plotly.js"));

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

function computeBandPowers(signal: SignalData) {
  const values = signal.values;
  if (!values.length) {
    return {
      delta: 0,
      theta: 0,
      alpha: 0,
      beta: 0,
      gamma: 0,
    };
  }

  const delta = movingAverage(values, Math.max(8, Math.round(signal.samplingRate / 6)));
  const theta = movingAverage(values, Math.max(6, Math.round(signal.samplingRate / 8)));
  const alpha = movingAverage(values, Math.max(4, Math.round(signal.samplingRate / 12)));
  const beta = movingAverage(values, Math.max(3, Math.round(signal.samplingRate / 18)));
  const gamma = movingAverage(values, Math.max(2, Math.round(signal.samplingRate / 24)));

  const power = (band: number[]) => band.reduce((sum, value) => sum + value * value, 0) / band.length;

  return {
    delta: power(delta),
    theta: power(theta),
    alpha: power(alpha),
    beta: power(beta),
    gamma: power(gamma),
  };
}

export function EEGLab() {
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [filteredSignal, setFilteredSignal] = useState<SignalData | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("none");
  const [bandPowers, setBandPowers] = useState({ delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 });
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);

  const activeSignal = useMemo(() => {
    if (!signal) {
      return null;
    }

    const channelValues = getSignalChannel(signal, selectedChannelIndex);
    const values = channelValues?.length ? channelValues : signal.values;
    const length = Math.min(values.length, signal.time.length);

    return {
      ...signal,
      values: values.slice(0, length),
      time: signal.time.slice(0, length),
      samples: values.slice(0, length).length,
    } satisfies SignalData;
  }, [selectedChannelIndex, signal]);

  useEffect(() => {
    if (!activeSignal) {
      setFilteredSignal(null);
      setBandPowers({ delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 });
      return;
    }

    const nextFilteredSignal = applySignalFilter(activeSignal, activeFilter);
    setFilteredSignal(nextFilteredSignal);
    setBandPowers(computeBandPowers(nextFilteredSignal));
  }, [activeFilter, activeSignal]);

  useEffect(() => {
    if (!signal?.channels?.length) {
      return;
    }

    setSelectedChannelIndex((currentIndex) => (currentIndex >= signal.channels!.length ? 0 : currentIndex));
  }, [signal]);

  const overview = useMemo(() => {
    if (!activeSignal) {
      return "Carga una señal EEG para comenzar a analizar las bandas cerebrales.";
    }

    return `Señal cargada: ${activeSignal.name} • ${activeSignal.samples} muestras • ${activeSignal.samplingRate} Hz`;
  }, [activeSignal]);

  const detectedBands = useMemo(() => {
    const entries = Object.entries(bandPowers) as Array<[string, number]>;
    const max = Math.max(...entries.map(([, power]) => power));
    return entries
      .filter(([, power]) => power >= max * 0.7)
      .map(([band]) => band.charAt(0).toUpperCase() + band.slice(1));
  }, [bandPowers]);

  const spectralAnalysis = useMemo(() => computeSpectralAnalysis(filteredSignal ?? activeSignal), [activeSignal, filteredSignal]);

  const channelOptions = useMemo(() => {
    if (!signal?.channelNames?.length) {
      return [{ label: "Canal 1", value: 0 }];
    }

    return signal.channelNames.map((name, index) => ({ label: name, value: index }));
  }, [signal]);

  const recordingDuration = activeSignal ? (activeSignal.time[activeSignal.time.length - 1] - activeSignal.time[0]) : 0;

  const educationalContent = {
    title: "Señal EEG",
    description: "El EEG registra la actividad eléctrica cerebral y permite identificar bandas asociadas a distintos estados cognitivos.",
    why: "El análisis de bandas ayuda a describir estados de descanso, atención, concentración y actividad mental.",
    physiology: "Las bandas delta, theta, alpha, beta y gamma reflejan patrones de sincronización neuronal que cambian con el estado de alerta y la tarea realizada.",
  };

  const metricsCards = [
    { label: "Frecuencia de muestreo", value: `${activeSignal?.samplingRate ?? 0} Hz`, icon: Activity },
    { label: "Duración del registro", value: `${recordingDuration.toFixed(2)} s`, icon: Clock3 },
    { label: "Potencia Delta", value: bandPowers.delta.toFixed(3), icon: BrainCircuit },
    { label: "Potencia Theta", value: bandPowers.theta.toFixed(3), icon: BrainCircuit },
    { label: "Potencia Alpha", value: bandPowers.alpha.toFixed(3), icon: BrainCircuit },
    { label: "Potencia Beta", value: bandPowers.beta.toFixed(3), icon: BrainCircuit },
    { label: "Potencia Gamma", value: bandPowers.gamma.toFixed(3), icon: BrainCircuit },
  ];

  const interpretation = useMemo(() => {
    const entries = Object.entries(bandPowers) as Array<[string, number]>;
    const dominantBand = entries.reduce((previous, current) => (current[1] > previous[1] ? current : previous), entries[0] ?? ["delta", 0]);

    if (!activeSignal) {
      return {
        highlight: "Esperando señal EEG válida para generar una interpretación.",
        description: "Carga un registro con suficiente duración para estimar la distribución relativa de energía en las bandas cerebrales.",
        details: ["Se analizará la potencia espectral de Delta, Theta, Alpha, Beta y Gamma."],
      };
    }

    const bandName = dominantBand[0];
    const bandLabel = bandName.charAt(0).toUpperCase() + bandName.slice(1);
    const bandValue = dominantBand[1];

    if (bandValue < 1e-6) {
      return {
        highlight: "No se detecta una banda dominante clara.",
        description: "La energía se reparte de manera relativamente uniforme, lo que puede indicar un registro con poca estructura o artefactos.",
        details: ["Banda predominante: ninguna", "Se recomienda revisar la calidad del registro y el canal seleccionado."],
      };
    }

    const physiologyMap: Record<string, string> = {
      delta: "La banda delta suele estar más activa durante sueño profundo o estados de baja vigilancia.",
      theta: "La banda theta se asocia a relajación, procesamiento interno y estados de transición mental.",
      alpha: "La banda alpha suele dominar en estados de relajación con ojos cerrados y bajo nivel de actividad cognitiva.",
      beta: "La banda beta se asocia a atención, concentración y procesamiento activo de información.",
      gamma: "La banda gamma aparece en tareas cognitivas complejas y procesos de integración sensorial.",
    };

    return {
      highlight: `Banda predominante: ${bandLabel}.`,
      description: physiologyMap[bandName] ?? "La distribución espectral sugiere un patrón neurofisiológico específico que puede interpretarse junto con el contexto experimental.",
      details: ["Potencia dominante: " + bandValue.toFixed(3), "Señal analizada: " + activeSignal.name, "Canal activo: " + (signal?.channelNames?.[selectedChannelIndex] ?? "Canal 1")],
    };
  }, [activeSignal, bandPowers, selectedChannelIndex, signal?.channelNames]);

  const analysisMetrics = useMemo(
    () => ({
      "Frecuencia de muestreo": `${activeSignal?.samplingRate ?? 0} Hz`,
      "Duración del registro": `${recordingDuration.toFixed(2)} s`,
      "Potencia Delta": bandPowers.delta.toFixed(3),
      "Potencia Theta": bandPowers.theta.toFixed(3),
      "Potencia Alpha": bandPowers.alpha.toFixed(3),
      "Potencia Beta": bandPowers.beta.toFixed(3),
      "Potencia Gamma": bandPowers.gamma.toFixed(3),
    }),
    [activeSignal?.samplingRate, bandPowers.alpha, bandPowers.beta, bandPowers.delta, bandPowers.gamma, bandPowers.theta, recordingDuration],
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
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-400 shadow-glow">
              <BrainCircuit className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">Laboratorio Virtual</p>
              <p className="text-xs text-muted-foreground">EEG • bandas cerebrales • análisis</p>
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
        <section className="rounded-[1.75rem] border border-primary/10 bg-gradient-to-r from-violet-600 to-fuchsia-500 p-6 text-white shadow-glow sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-teal" />
                Módulo de neuroseñales
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Laboratorio Virtual para señales EEG</h1>
              <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
                Carga un archivo CSV, visualiza la señal, aplica filtros básicos y analiza las bandas cerebrales con explicaciones educativas adaptadas.
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
              title="Carga una señal EEG"
              description="Sube un archivo CSV con valores de EEG para visualizar la actividad cerebral y analizar sus bandas."
              signalType="eeg"
            />
            <Card className="border-primary/10 bg-card/80 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Waves className="h-5 w-5 text-primary" />
                  Canal EEG
                </CardTitle>
                <CardDescription>
                  Selecciona el canal que deseas inspeccionar cuando el archivo contiene múltiples series de EEG.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-4">
                <div className="min-w-[220px] flex-1">
                  <Select
                    value={String(selectedChannelIndex)}
                    onValueChange={(value) => setSelectedChannelIndex(Number(value))}
                    disabled={!channelOptions.length}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {channelOptions.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Canal activo</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{channelOptions[selectedChannelIndex]?.label ?? "Canal 1"}</p>
                </div>
              </CardContent>
            </Card>
            <ProcessingPanel
              signal={activeSignal}
              filteredSignal={filteredSignal}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
            <SignalViewer
              signal={activeSignal}
              filteredSignal={filteredSignal}
              title="Visualización de la señal EEG"
              valueLabel="Amplitud cerebral"
              valueUnit="µV"
              emptyState="Sube un archivo CSV para visualizar la señal EEG."
            />
            <Card className="border-primary/10 bg-card/80 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Espectro de potencia</CardTitle>
                <CardDescription>
                  FFT interactiva con zoom para inspeccionar la energía de la señal en frecuencia.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {spectralAnalysis.frequencies.length ? (
                  <div className="h-[320px] rounded-2xl border border-border/70 bg-background/70 p-2">
                    <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Cargando FFT…</div>}>
                      <Plot
                        data={[
                          {
                            x: spectralAnalysis.frequencies,
                            y: spectralAnalysis.powerSpectrum,
                            type: "scatter",
                            mode: "lines",
                            name: "Potencia espectral",
                            line: { color: "#8b5cf6", width: 2.4 },
                            hovertemplate: "%{y:.3f}<extra></extra>",
                          },
                        ]}
                        layout={{
                          autosize: true,
                          margin: { l: 45, r: 10, t: 30, b: 40 },
                          paper_bgcolor: "rgba(0,0,0,0)",
                          plot_bgcolor: "rgba(0,0,0,0)",
                          dragmode: "zoom",
                          xaxis: { title: "Frecuencia (Hz)", showgrid: true, gridcolor: "rgba(15,23,42,0.08)" },
                          yaxis: { title: "Potencia", showgrid: true, gridcolor: "rgba(15,23,42,0.08)" },
                        }}
                        config={{ displayModeBar: true, responsive: true, scrollZoom: true }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-gradient-soft text-sm text-muted-foreground">
                    Carga una señal EEG para calcular su FFT.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <MetricsPanel
              metrics={null}
              title="Métricas EEG"
              description="Resumen cuantitativo de las principales bandas cerebrales detectadas."
              cards={metricsCards}
            />
            <AutomaticInterpretationCard
              icon={Brain}
              title="Interpretación automática"
              subtitle="Resumen neurofisiológico guiado por bandas EEG"
              tone="eeg"
              highlight={interpretation.highlight}
              description={interpretation.description}
              details={interpretation.details}
            />
            <AnalysisResultsPanel
              labType="eeg"
              signal={activeSignal}
              metrics={analysisMetrics}
              results={analysisResults}
            />
            <Card className="border-primary/10 bg-card/80 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Análisis de bandas cerebrales</CardTitle>
                <CardDescription>
                  Se identifican las bandas con mayor participación en la señal cargada.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  {detectedBands.length ? (
                    <div className="flex flex-wrap gap-2">
                      {detectedBands.map((band) => (
                        <span key={band} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                          {band}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Carga una señal para identificar las bandas cerebrales predominantes.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <EducationalPanel filterType={activeFilter} content={educationalContent} />
          </div>
        </div>
      </main>
    </div>
  );
}
