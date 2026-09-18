import { Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignalViewer } from "@/components/SignalViewer/SignalViewer";
import {
  isFilterAdmissible,
  type FilterType,
  type SignalData,
} from "@/components/LaboratorioVirtual/signal-utils";

type ProcessingPanelProps = {
  signal: SignalData | null;
  filteredSignal: SignalData | null;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  peaks?: number[];
  title?: string;
  description?: string;
  showFilters?: boolean;
  /** Filtros que admite la modalidad. Por defecto, todos. */
  allowedFilters?: FilterType[];
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
  allowedFilters,
}: ProcessingPanelProps) {
  const visibleFilters = allowedFilters
    ? filters.filter((filter) => allowedFilters.includes(filter.value))
    : filters;

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
            {visibleFilters.map((filter) => {
              const admissible = !signal || isFilterAdmissible(filter.value, signal.samplingRate);
              return (
                <Button
                  key={filter.value}
                  size="sm"
                  variant={activeFilter === filter.value ? "default" : "outline"}
                  onClick={() => onFilterChange(filter.value)}
                  disabled={!admissible}
                  title={admissible ? undefined : "No realizable: la frecuencia del filtro alcanza el límite de Nyquist de esta señal."}
                >
                  {filter.label}
                </Button>
              );
            })}
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
