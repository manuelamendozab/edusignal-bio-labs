import { createFileRoute } from "@tanstack/react-router";
import { EMGLab } from "@/components/LaboratorioVirtual/EMGLab";

export const Route = createFileRoute("/laboratorio/emg")({
  head: () => ({
    meta: [
      { title: "Laboratorio EMG — EduSignal" },
      {
        name: "description",
        content: "Laboratorio virtual para cargar, visualizar y analizar señales EMG con métricas musculares y explicaciones educativas.",
      },
    ],
  }),
  component: EMGLab,
});
