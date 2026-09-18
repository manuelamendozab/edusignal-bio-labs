import { Activity, TimerReset, Waves, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricSummary } from "@/components/LaboratorioVirtual/signal-utils";

type MetricCard = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type MetricsPanelProps = {
  metrics?: MetricSummary | null;
  title?: string;
  description?: string;
  cards?: MetricCard[];
};

export function MetricsPanel({
  metrics,
  title = "Métricas cardíacas",
  description = "Frecuencia cardíaca e índices de variabilidad (HRV) en el dominio del tiempo.",
  cards,
}: MetricsPanelProps) {
  const resolvedCards = cards ?? [
    { label: "FC (bpm)", value: metrics?.bpm?.toFixed(1) ?? "0.0", icon: Activity },
    { label: "RR medio", value: `${metrics?.rrMeanMs?.toFixed(1) ?? "0.0"} ms`, icon: TimerReset },
    { label: "Latidos", value: metrics?.beatCount?.toString() ?? "0", icon: Activity },
    { label: "SDNN", value: `${metrics?.sdnnMs?.toFixed(1) ?? "0.0"} ms`, icon: Waves },
    { label: "RMSSD", value: `${metrics?.rmssdMs?.toFixed(1) ?? "0.0"} ms`, icon: Waves },
    { label: "pNN50", value: `${metrics?.pnn50?.toFixed(1) ?? "0.0"} %`, icon: Waves },
  ];

  return (
    <Card className="border-primary/10 bg-card/80 shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {resolvedCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className="h-4 w-4 text-primary" />
                {card.label}
              </div>
              <div className="mt-3 text-3xl font-semibold text-foreground">{card.value}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
