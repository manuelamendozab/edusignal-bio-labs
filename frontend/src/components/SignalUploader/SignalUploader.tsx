import { FileUp } from "lucide-react";
import { useId, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SignalData } from "@/components/LaboratorioVirtual/signal-utils";
import { parseCsvSignal, parseEdfSignal, parseWfdbSignal } from "@/components/LaboratorioVirtual/signal-utils";

type SignalType = "ecg" | "emg" | "eeg";
type FeedbackTone = "info" | "warning" | "error";

type SignalUploaderProps = {
  onSignalLoaded: (signal: SignalData) => void;
  signal?: SignalData | null;
  title?: string;
  description?: string;
  emptyState?: string;
  buttonLabel?: string;
  signalType?: SignalType;
};

const signalTypeLabels: Record<SignalType, string> = {
  ecg: "ECG",
  emg: "EMG",
  eeg: "EEG",
};

const signalTypeExtensions: Record<SignalType, string[]> = {
  ecg: [".csv", ".dat", ".hea"],
  emg: [".csv", ".dat", ".hea"],
  eeg: [".csv", ".edf"],
};

function getFileExtension(fileName: string): string {
  return fileName.toLowerCase().slice(fileName.lastIndexOf("."));
}

function formatExtensions(extensions: string[]): string {
  return extensions.join(", ");
}

export function SignalUploader({
  onSignalLoaded,
  signal,
  title = "Carga de señal ECG",
  description = "Sube un archivo CSV con valores de ECG para visualizarlo, filtrar y analizar.",
  emptyState = "Sin cargar",
  buttonLabel = "Elegir archivo",
  signalType = "ecg",
}: SignalUploaderProps) {
  const fileInputId = useId();
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const label = signalTypeLabels[signalType];
  const acceptedExtensions = signalTypeExtensions[signalType];
  const acceptedText = formatExtensions(acceptedExtensions);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) return;

    const firstFile = selectedFiles[0];
    const extension = getFileExtension(firstFile.name);
    setSelectedFileName(firstFile.name);

    const datFile = selectedFiles.find((file) => getFileExtension(file.name) === ".dat");
    const heaFile = selectedFiles.find((file) => getFileExtension(file.name) === ".hea");

    if (datFile && heaFile) {
      try {
        const parsed = await parseWfdbSignal(datFile, heaFile);
        onSignalLoaded(parsed);
        setFeedback({ tone: "info", message: `Archivo WFDB cargado correctamente desde ${datFile.name} y ${heaFile.name}.` });
      } catch (error) {
        console.error(error);
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "No se pudo procesar la pareja WFDB seleccionada.",
        });
      }
      return;
    }

    if (!acceptedExtensions.includes(extension)) {
      setFeedback({
        tone: "error",
        message: `Formato ${extension || "desconocido"} no válido para ${label}. Usa alguno de: ${acceptedText}.`,
      });
      return;
    }

    if (extension === ".dat") {
      setFeedback({
        tone: "warning",
        message: "Se detectó un archivo WFDB .dat. Selecciona también el archivo .hea correspondiente para cargar la señal.",
      });
      return;
    }

    if (extension === ".hea") {
      setFeedback({
        tone: "warning",
        message: "Archivo .hea detectado. Selecciona también el archivo .dat correspondiente para cargar la señal.",
      });
      return;
    }

    if (extension === ".edf") {
      try {
        const parsed = await parseEdfSignal(firstFile);
        onSignalLoaded(parsed);
        const channelInfo = parsed.channels ? ` • ${parsed.channels.length} canales` : "";
        setFeedback({
          tone: "info",
          message: `Archivo EDF ${firstFile.name} cargado: ${parsed.samplingRate} Hz${channelInfo}.`,
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "No se pudo leer el archivo EDF.",
        });
      }
      return;
    }

    try {
      const parsed = await parseCsvSignal(firstFile);
      onSignalLoaded(parsed);
      setFeedback({ tone: "info", message: `Archivo ${firstFile.name} cargado correctamente y listo para visualizar.` });
    } catch (error) {
      console.error(error);
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo procesar el archivo seleccionado.",
      });
    }
  };

  const feedbackClasses: Record<FeedbackTone, string> = {
    info: "border-primary/20 bg-primary/5 text-primary",
    warning: "border-amber-300 bg-amber-50 text-amber-700",
    error: "border-red-300 bg-red-50 text-red-700",
  };

  return (
    <Card className="border-primary/10 bg-card/70 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileUp className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label
          htmlFor={fileInputId}
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-gradient-soft px-6 py-8 text-center transition hover:border-primary/50 hover:bg-primary/5"
        >
          <FileUp className="mb-3 h-10 w-10 text-primary" />
          <span className="text-sm font-semibold text-foreground">Selecciona un archivo</span>
          <span className="mt-1 text-sm text-muted-foreground">Compatible con {label} y preparado para futuras integraciones de WFDB/MNE</span>
          <input id={fileInputId} type="file" accept={acceptedExtensions.join(",")} multiple className="hidden" onChange={handleFileChange} />
        </label>

        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Formatos compatibles</p>
          <p className="mt-1 text-sm font-medium text-foreground">{acceptedText}</p>
          <p className="mt-1 text-sm text-muted-foreground">Se aceptan archivos de entrada para {label} según el laboratorio actual.</p>
        </div>

        {feedback ? <div className={`rounded-xl border px-3 py-2 text-sm ${feedbackClasses[feedback.tone]}`}>{feedback.message}</div> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Archivo</p>
            <p className="mt-1 text-sm font-medium text-foreground">{signal?.name ?? selectedFileName ?? emptyState}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Muestras</p>
            <p className="mt-1 text-sm font-medium text-foreground">{signal?.samples ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Frecuencia</p>
            <p className="mt-1 text-sm font-medium text-foreground">{signal ? `${signal.samplingRate} Hz` : "—"}</p>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => (document.getElementById(fileInputId) as HTMLInputElement | null)?.click()}
        >
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
