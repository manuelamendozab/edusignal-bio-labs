import { Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignalViewer } from "@/components/SignalViewer/SignalViewer";
import type { FilterType, SignalData } from "@/components/LaboratorioVirtual/signal-utils";

type ProcessingPanelProps = {
  signal: SignalData | null;
  filteredSignal: SignalData | null;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  peaks?: number[];
  title?: string;
  description?: string;
  showFilters?: boolean;
};

const filters: Array<{ value: FilterType; label: string }> = [
  { value: "none", label: "Sin filtro" },
  { value: "high-pass", label: "Pasa altas" },
  { value: "low-pass", label: "Pasa bajas" },
  { value: "band-pass", label: "Pasa banda" },
  { value: "notch", label: "Notch 60 Hz" },
];

export function ProcessingPanel({
  signal,
  filteredSignal,
  activeFilter,
  onFilterChange,
  peaks,
  title = "Procesamiento de señal",
  description = "Aplica filtros básicos y compara la señal original con la versión filtrada.",
  showFilters = true,
}: ProcessingPanelProps) {
  return (
    <Card className="border-primary/10 bg-card/80 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showFilters ? (
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <Button
                key={filter.value}
                size="sm"
                variant={activeFilter === filter.value ? "default" : "outline"}
                onClick={() => onFilterChange(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3 text-sm text-muted-foreground">
            La señal se muestra en su forma original y en su versión rectificada con suavizado RMS para resaltar la actividad muscular.
          </div>
        )}

        <SignalViewer signal={signal} filteredSignal={filteredSignal} peaks={peaks} title="Comparación original vs procesada" />
      </CardContent>
    </Card>
  );
}
