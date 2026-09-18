import { TriangleAlert } from "lucide-react";

type ClinicalDisclaimerProps = {
  className?: string;
  /** "banner" para la cabecera de un laboratorio; "inline" para pies de página. */
  variant?: "banner" | "inline";
  /** Texto alternativo; por defecto, el aviso de los laboratorios. */
  text?: string;
};

const DISCLAIMER_TEXT =
  "Las métricas e interpretaciones que genera esta plataforma se calculan con algoritmos de demostración y no han sido validadas clínicamente. No deben usarse para diagnosticar, tratar ni tomar decisiones sobre la salud de ninguna persona.";

/**
 * Aviso del asistente conversacional. A diferencia de los laboratorios, aquí
 * el riesgo no es un algoritmo sin validar sino un modelo de lenguaje cuyas
 * respuestas no se verifican y que no tiene acceso a la señal cargada.
 */
export const ASSISTANT_DISCLAIMER_TEXT =
  "Las respuestas las genera un modelo de lenguaje de propósito general, no se verifican y no tienen acceso a la señal que hayas cargado. Sirven como apoyo al estudio: no son consejo clínico ni deben usarse para diagnosticar o tratar a ninguna persona.";

/**
 * Aviso obligatorio en toda vista que muestre métricas fisiológicas o
 * interpretaciones automáticas: EduSignal es material didáctico, no un
 * dispositivo médico.
 */
export function ClinicalDisclaimer({
  className = "",
  variant = "banner",
  text = DISCLAIMER_TEXT,
}: ClinicalDisclaimerProps) {
  if (variant === "inline") {
    return (
      <p className={`text-xs leading-relaxed text-muted-foreground ${className}`}>
        <span className="font-semibold text-foreground">
          Herramienta educativa, no dispositivo médico.
        </span>{" "}
        {text}
      </p>
    );
  }

  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 ${className}`}
    >
      <TriangleAlert
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden
      />
      <div>
        <p className="text-sm font-semibold">Herramienta educativa, no dispositivo médico</p>
        <p className="mt-1 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/80">
          {text}
        </p>
      </div>
    </div>
  );
}
