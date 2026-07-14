import { createFileRoute } from "@tanstack/react-router";
import { ECGLab } from "@/components/LaboratorioVirtual/ECGLab";

export const Route = createFileRoute("/laboratorio/ecg")({
  head: () => ({
    meta: [
      { title: "Laboratorio ECG — EduSignal" },
      {
        name: "description",
        content: "Laboratorio virtual para cargar, visualizar, filtrar y analizar señales ECG con métricas y explicaciones educativas.",
      },
    ],
  }),
  component: ECGLab,
});
