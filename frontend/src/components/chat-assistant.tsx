import { useState, useRef, useEffect } from 'react';
import { Loader2, Send, Zap } from 'lucide-react';
import {
  ASSISTANT_DISCLAIMER_TEXT,
  ClinicalDisclaimer,
} from '@/components/ClinicalDisclaimer/ClinicalDisclaimer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatAssistant({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: '¡Hola! Soy el asistente inteligente de EduSignal. Puedo responder preguntas sobre bioseñales (ECG, EMG, EEG), procesamiento digital de señales y todo lo relacionado con la plataforma. ¿Cómo puedo ayudarte hoy?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Claude');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, no pude procesar tu pregunta. Por favor, verifica tu conexión y intenta de nuevo.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex ${embedded ? 'h-full min-h-[420px]' : 'h-screen'} flex-col bg-background`}>
      <div className="border-b border-border bg-card/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-teal-500" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Asistente Claude</h1>
            <p className="text-sm text-muted-foreground">
              Haz preguntas sobre bioseñales y la plataforma
            </p>
          </div>
        </div>
        {/*
          El asistente es un modelo de lenguaje de proposito general adaptado
          solo por prompt de sistema: sus respuestas no se verifican ni se
          apoyan en las metricas calculadas, asi que la vista debe advertirlo
          igual que los laboratorios.
        */}
        <ClinicalDisclaimer
          variant="inline"
          text={ASSISTANT_DISCLAIMER_TEXT}
          className="mt-2 border-t border-border/60 pt-2"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'border-teal-500/40 bg-teal-500/15 text-foreground'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {msg.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
                  Claude está pensando...
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t border-border bg-card/50 p-3">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            aria-label="Escribe tu pregunta"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            disabled={loading}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center justify-center rounded-md bg-gradient-brand px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
