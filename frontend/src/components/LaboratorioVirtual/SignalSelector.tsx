import { Activity, ArrowRight, BrainCircuit, HeartPulse } from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClinicalDisclaimer } from "@/components/ClinicalDisclaimer/ClinicalDisclaimer";

type SignalOption = {
  id: "ecg" | "emg" | "eeg";
  title: string;
  description: string;
  route: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
};

const signalOptions: SignalOption[] = [
  {
    id: "ecg",
    title: "ECG",
    description: "Analiza ritmos cardíacos y detecta picos R con métricas clínicas básicas.",
    route: "/laboratorio/ecg",
    icon: HeartPulse,
    accent: "from-primary to-cyan-400",
  },
  {
    id: "emg",
    title: "EMG",
    description: "Explora activaciones musculares y evalúa la energía de la contracción.",
    route: "/laboratorio/emg",
    icon: Activity,
    accent: "from-emerald-500 to-teal-400",
  },
  {
    id: "eeg",
    title: "EEG",
    description: "Estudia bandas cerebrales y patrones asociados a estados cognitivos.",
    route: "/laboratorio/eeg",
    icon: BrainCircuit,
    accent: "from-violet-500 to-fuchsia-400",
  },
];

export function SignalSelector() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-primary/10 bg-gradient-hero p-6 text-white shadow-glow sm:p-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Seleccionar Bioseñal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Elige la señal que quieres explorar</h1>
          <p className="mt-3 text-sm text-white/80 sm:text-base">
            Comienza con ECG, EMG o EEG y accede a un laboratorio virtual adaptado a cada tipo de bioseñal.
          </p>
        </div>
      </section>

      <ClinicalDisclaimer />

      <div className="grid gap-6 lg:grid-cols-3">
        {signalOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Card key={option.id} className="overflow-hidden border-primary/10 bg-card/90 shadow-card">
              <div className={`h-2 bg-gradient-to-r ${option.accent}`} />
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="mt-2 text-2xl">{option.title}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to={option.route}>
                    Abrir laboratorio
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
