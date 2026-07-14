import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ToneKey = "ecg" | "emg" | "eeg";

type AutomaticInterpretationCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone: ToneKey;
  highlight: string;
  description: string;
  details?: string[];
};

const toneClasses: Record<ToneKey, { card: string; icon: string; badge: string; text: string }> = {
  ecg: {
    card: "border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-orange-50",
    icon: "bg-rose-500/10 text-rose-600",
    badge: "bg-rose-500/10 text-rose-700",
    text: "text-rose-700",
  },
  emg: {
    card: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50",
    icon: "bg-emerald-500/10 text-emerald-600",
    badge: "bg-emerald-500/10 text-emerald-700",
    text: "text-emerald-700",
  },
  eeg: {
    card: "border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50",
    icon: "bg-violet-500/10 text-violet-600",
    badge: "bg-violet-500/10 text-violet-700",
    text: "text-violet-700",
  },
};

export function AutomaticInterpretationCard({
  icon: Icon,
  title,
  subtitle,
  tone,
  highlight,
  description,
  details = [],
}: AutomaticInterpretationCardProps) {
  const classes = toneClasses[tone];

  return (
    <Card className={`border-primary/10 shadow-card ${classes.card}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className={`grid h-10 w-10 place-items-center rounded-2xl ${classes.icon}`}>
                <Icon className="h-5 w-5" />
              </span>
              {title}
            </CardTitle>
            <CardDescription className="mt-2">{subtitle}</CardDescription>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes.badge}`}>Automática</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`rounded-2xl border border-border/60 bg-background/70 p-4 ${classes.text}`}>
          <p className="text-sm font-semibold">{highlight}</p>
          <p className="mt-2 text-sm leading-6 text-foreground/80">{description}</p>
        </div>
        {details.length ? (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {details.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${classes.badge}`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
