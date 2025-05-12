
'use client';

import { useState, useEffect, useRef } from 'react';
import { useDebug, type DebugLogEntry } from '@/contexts/DebugContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function DebugLogWindow() {
  const { isDebugModeActive, debugLogs, clearDebugLogs } = useDebug();
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isExpanded && scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        // Scroll to bottom when new logs are added and window is expanded
        // Using requestAnimationFrame to ensure DOM update before scrolling
        requestAnimationFrame(() => {
            scrollViewport.scrollTop = scrollViewport.scrollHeight;
        });
      }
    }
  }, [debugLogs, isExpanded]);


  if (!isDebugModeActive) {
    return null;
  }

  const handleCopyLogs = () => {
    const logText = debugLogs
        .slice() // Create a copy to reverse without mutating original
        .reverse() // Show oldest first for copy
        .map(log => 
            `[${log.timestamp}] [${log.source}] [${log.type}] ${log.message}${log.data ? `\n  Data: ${JSON.stringify(log.data, null, 2)}` : ''}`
        )
        .join('\n\n');
    navigator.clipboard.writeText(logText)
      .then(() => toast({ title: 'Logs Copiados', description: 'Los logs de depuración han sido copiados.' }))
      .catch(() => toast({ title: 'Error al Copiar', description: 'No se pudieron copiar los logs.', variant: 'destructive' }));
  };

  const getLogColor = (type: DebugLogEntry['type']) => {
    switch (type) {
      case 'ERROR': return 'text-destructive';
      case 'WARN': return 'text-yellow-500 dark:text-yellow-400';
      case 'INFO': return 'text-blue-500 dark:text-blue-400';
      case 'DEBUG': return 'text-gray-500 dark:text-gray-400';
      case 'ORCHESTRATOR': return 'text-purple-500 dark:text-purple-400';
      case 'AGENT': return 'text-green-500 dark:text-green-400';
      case 'SYSTEM': return 'text-teal-500 dark:text-teal-400';
      default: return 'text-foreground';
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-background/90 backdrop-blur-sm border-t border-border shadow-2xl">
      <div className="flex items-center justify-between p-2 h-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium text-foreground flex items-center gap-1"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          Registro de Depuración
          <span className="ml-2 text-xs text-muted-foreground">({debugLogs.length} entradas)</span>
        </Button>
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleCopyLogs} title="Copiar Logs" disabled={debugLogs.length === 0}>
                <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={clearDebugLogs} title="Limpiar Logs" disabled={debugLogs.length === 0}>
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
      </div>
      {isExpanded && (
        <ScrollArea 
          ref={scrollAreaRef}
          className="h-64 w-full bg-card/80 border-t border-border"
        >
          <div className="p-3 space-y-1">
            {debugLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No hay logs de depuración.</p>}
            {debugLogs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className={cn("text-xs font-mono leading-relaxed p-1 rounded-sm hover:bg-muted/50", getLogColor(log.type))}>
                <span className="text-muted-foreground mr-1">[{new Date(log.timestamp).toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}]</span>
                <span className="font-semibold mr-1">[{log.source}]</span>
                <span className="font-semibold mr-1">[{log.type}]</span>
                <span>{log.message}</span>
                {log.data && (
                  <details className="ml-4 mt-0.5 text-[10px] opacity-80">
                    <summary className="cursor-pointer italic text-muted-foreground">Ver Datos</summary>
                    <pre className="mt-0.5 p-1 border bg-background rounded max-h-40 overflow-auto whitespace-pre-wrap break-all">
                      {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
