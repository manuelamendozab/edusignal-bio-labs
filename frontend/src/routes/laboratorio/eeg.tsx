import { createFileRoute } from "@tanstack/react-router";
import { EEGLab } from "@/components/LaboratorioVirtual/EEGLab";

export const Route = createFileRoute("/laboratorio/eeg")({
  head: () => ({
    meta: [
      { title: "Laboratorio EEG — EduSignal" },
      {
        name: "description",
        content: "Laboratorio virtual para cargar, visualizar y analizar señales EEG con métricas de bandas cerebrales y explicaciones educativas.",
      },
    ],
  }),
  component: EEGLab,
});
