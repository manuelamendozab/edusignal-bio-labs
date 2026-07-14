import { createFileRoute } from "@tanstack/react-router";
import { ChatAssistant } from "@/components/chat-assistant";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Asistente Claude — EduSignal" },
      {
        name: "description",
        content: "Habla con Claude, el asistente inteligente de EduSignal. Haz preguntas sobre bioseñales y procesamiento digital de señales.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return <ChatAssistant />;
}
