import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SignalSelector } from "@/components/LaboratorioVirtual/SignalSelector";

export const Route = createFileRoute("/laboratorio")({
  head: () => ({
    meta: [
      { title: "Seleccionar Bioseñal — EduSignal" },
      {
        name: "description",
        content: "Elige entre ECG, EMG y EEG para abrir el laboratorio virtual correspondiente.",
      },
    ],
  }),
  component: LaboratorioPage,
});

function LaboratorioPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname === "/laboratorio") {
    return <SignalSelector />;
  }

  return <Outlet />;
}
