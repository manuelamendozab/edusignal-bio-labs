import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EducationalContent, FilterType } from "@/components/LaboratorioVirtual/signal-utils";
import { getEducationalContent } from "@/components/LaboratorioVirtual/signal-utils";

type EducationalPanelProps = {
  filterType?: FilterType;
  content?: EducationalContent;
};

export function EducationalPanel({ filterType = "none", content }: EducationalPanelProps) {
  const resolvedContent: EducationalContent = content ?? getEducationalContent(filterType);

  return (
    <Card className="border-primary/10 bg-card/80 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GraduationCap className="h-5 w-5 text-primary" />
          Explicación educativa
        </CardTitle>
        <CardDescription>
          Cada procesamiento muestra por qué se aplica y qué información fisiológica revela.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-2xl border border-primary/10 bg-gradient-soft p-4">
          <p className="text-sm font-semibold text-primary">{resolvedContent.title}</p>
          <p className="mt-2 text-sm text-foreground">{resolvedContent.description}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">¿Por qué se usa?</p>
            <p className="mt-2 text-sm text-muted-foreground">{resolvedContent.why}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">Información fisiológica</p>
            <p className="mt-2 text-sm text-muted-foreground">{resolvedContent.physiology}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
