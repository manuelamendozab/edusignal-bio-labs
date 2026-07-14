import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChatAssistant } from '@/components/chat-assistant';
import { MessageSquare, X } from 'lucide-react';

export function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="fixed bottom-6 right-6 z-50 flex items-end">
        {open && (
          <div className="mr-3 hidden w-[360px] max-w-[90vw] flex-col rounded-lg border border-border bg-card shadow-lg md:flex">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-teal-500" />
                <div className="text-sm font-medium">Asistente</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                aria-label="Cerrar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[520px] min-h-[420px] w-full overflow-hidden">
              <ChatAssistant embedded />
            </div>
          </div>
        )}

        <Button
          onClick={() => setOpen((v) => !v)}
          size="icon"
          className="rounded-full bg-gradient-brand text-primary-foreground shadow-lg"
          aria-label="Abrir chat"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile fixed full-screen panel */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full rounded-t-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-teal-500" />
                <div className="text-sm font-medium">Asistente</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                aria-label="Cerrar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[60vh] min-h-[420px] w-full overflow-hidden">
              <ChatAssistant embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
