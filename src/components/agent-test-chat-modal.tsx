// src/components/agent-test-chat-modal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, User, Sparkles, AlertTriangle, Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AgentConfig } from '@/types/agent';
import type { LLMOptions, ChatMessage } from '@/services/groq';
import { handleAgentChatCompletion } from '@/app/(app)/agents/actions'; // Import the new server action

interface AgentTestChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentConfig;
  llmOptions: LLMOptions; // Receive resolved LLM options
}

export function AgentTestChatModal({ isOpen, onClose, agent, llmOptions }: AgentTestChatModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]); // Only user/assistant messages
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Reset chat when modal opens with a new agent
  useEffect(() => {
    if (isOpen) {
      setChatHistory([]);
      setCurrentMessage('');
      setChatError(null);
      setIsLoading(false);
    }
  }, [isOpen, agent.id]); // Depend on agent.id to reset if agent changes while modal might be open (though usually closed/opened)

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !llmOptions) return;

    const newUserMessage: ChatMessage = { role: 'user', content: currentMessage };
    const currentChatHistory = [...chatHistory, newUserMessage]; // Include new user message for context
    setChatHistory(currentChatHistory); // Update UI immediately with user message
    setCurrentMessage('');
    setIsLoading(true);
    setChatError(null);

    // Pass only user/assistant history to action, system message is handled there
    const historyForApi = currentChatHistory.filter(msg => msg.role === 'user' || msg.role === 'assistant');

    const result = await handleAgentChatCompletion(agent.systemMessage, historyForApi, llmOptions);

    if (result.success && result.data) {
      const assistantMessage: ChatMessage = { role: 'assistant', content: result.data.content };
      setChatHistory(prev => [...prev, assistantMessage]); // Add assistant response
    } else {
      setChatError(result.error || 'Ocurrió un error desconocido durante la respuesta del chat.');
      // Remove the user message that failed to get a response? Or keep it? Keep for now.
      toast({
        title: 'Error en el Chat de Prueba',
        description: result.error || 'No se pudo obtener una respuesta.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

   const handleCopyError = (errorText: string | undefined) => {
    if (!errorText) return;
    navigator.clipboard.writeText(errorText)
      .then(() => {
        toast({ title: 'Error Copiado', description: 'El mensaje de error ha sido copiado al portapapeles.' });
      })
      .catch(err => {
        console.error('Error al copiar el error:', err);
        toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar el error al portapapeles.', variant: 'destructive' });
      });
  };

  const handleClearChat = () => {
    setChatHistory([]);
    setChatError(null);
    toast({ title: 'Chat Limpiado', description: 'El historial de este chat de prueba ha sido limpiado.' });
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Probando Agente: {agent.name}</DialogTitle>
          <DialogDescription>
            Interactúa directamente con este agente usando su mensaje de sistema y configuración LLM.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 p-4 md:p-6 overflow-hidden">
           <ScrollArea className="h-full" ref={scrollAreaRef}>
             <div className="space-y-4 pr-4">
                {/* Display System Message */}
                 <div className="flex items-start gap-3 opacity-70">
                     <Avatar className="h-8 w-8 border border-amber-500/50">
                        <AvatarFallback className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                            <User className="h-5 w-5" />
                        </AvatarFallback>
                    </Avatar>
                     <div className="max-w-[80%] p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-bl-none">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Mensaje de Sistema (Prompt del Agente)</p>
                        <pre className="text-xs text-amber-700 dark:text-amber-400 whitespace-pre-wrap break-words">{agent.systemMessage}</pre>
                    </div>
                 </div>

                {/* Chat History */}
                {chatHistory.map((msg, index) => (
                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <Avatar className="h-8 w-8 border border-primary/50">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        <Sparkles className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] p-3 rounded-lg shadow ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-card text-card-foreground border rounded-bl-none'
                    }`}
                  >
                    <pre className="text-sm whitespace-pre-wrap break-words">{msg.content}</pre>
                  </div>
                  {msg.role === 'user' && (
                    <Avatar className="h-8 w-8 border border-muted-foreground/50">
                      <AvatarFallback className="bg-muted/30 text-muted-foreground">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {/* Loading indicator */}
              {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length -1].role === 'user' && (
                 <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 border border-primary/50">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        <Sparkles className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[70%] p-3 rounded-lg shadow bg-card text-card-foreground border rounded-bl-none">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                 </div>
              )}
            </div>
          </ScrollArea>
        </div>

         {chatError && (
          <div className="p-4 border-t border-destructive bg-destructive/10 mx-6 mb-2 rounded">
            <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> Error en el Chat:
                </p>
                <Button variant="ghost" size="icon" onClick={() => handleCopyError(chatError)} title="Copiar Error">
                    <Copy className="h-4 w-4 text-destructive" />
                </Button>
            </div>
            <p className="text-xs text-destructive">{chatError}</p>
          </div>
        )}

        <DialogFooter className="p-4 pt-0 border-t">
          <div className="flex w-full items-center gap-2">
             <Textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Escribe tu mensaje al agente..."
              rows={1}
              className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm bg-card"
              disabled={isLoading}
            />
            <Button onClick={handleClearChat} variant="ghost" size="icon" disabled={isLoading || chatHistory.length === 0} title="Limpiar Chat">
              <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive"/>
            </Button>
             <Button onClick={handleSendMessage} disabled={isLoading || !currentMessage.trim()} className="h-10">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              <span className="sr-only">Enviar</span>
            </Button>
             <DialogClose asChild>
                <Button type="button" variant="outline">Cerrar</Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    