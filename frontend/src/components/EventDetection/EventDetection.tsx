import { RadioTower } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SignalData } from "@/components/LaboratorioVirtual/signal-utils";

type EventDetectionProps = {
  signal: SignalData | null;
  peaks: number[];
  title?: string;
  description?: string;
  countLabel?: string;
  emptyMessage?: string;
};

export function EventDetection({
  signal,
  peaks,
  title = "Detección de picos R",
  description = "Los picos detectados se señalan sobre la gráfica para facilitar la interpretación del ritmo cardíaco.",
  countLabel = "Picos R detectados",
  emptyMessage = "Carga una señal para iniciar la detección.",
}: EventDetectionProps) {
  return (
    <Card className="border-primary/10 bg-card/80 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RadioTower className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">{countLabel}</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{peaks.length}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {signal ? `Se analizaron ${signal.samples} muestras con una frecuencia de muestreo de ${signal.samplingRate} Hz.` : emptyMessage}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
