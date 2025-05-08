
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, User, Sparkles, AlertTriangle, Copy, Trash2, Settings2 } from 'lucide-react'; // Added Settings2
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { handleChatCompletion } from './actions';
import type { ChatMessage } from '@/services/groq';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select components
import type { AgentConfig } from '@/types/agent';
import { resolveLlmOptionsForSource } from '@/lib/llm-utils'; // Import the helper
import type { LLMOptions } from '@/services/groq'; // Import LLMOptions type
import { LOCALSTORAGE_AGENTS_KEY } from '@/config/agent-config'; // Import agents key

export default function ChatPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Agent and config source state
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global'); // Default to global
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null); // State for resolved options

  const { toast } = useToast();

  // Load agents from localStorage
  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try {
        setAgents(JSON.parse(storedAgents));
      } catch (e) {
        console.error("Error parsing stored agents:", e);
        setAgents([]);
      }
    }
  }, []);

  // Update resolved LLM options when config source or agents change
  useEffect(() => {
    const options = resolveLlmOptionsForSource(selectedConfigSource, agents);
    setResolvedLlmOptions(options);
  }, [selectedConfigSource, agents]);

  // Scroll to bottom when chat history updates
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;
    const options = resolvedLlmOptions;

    if (!options) {
         toast({
            title: "Configuración LLM Incompleta",
            description: `La configuración LLM seleccionada (${getSourceName(selectedConfigSource)}) está incompleta o no se pudo resolver. Revisa los Ajustes o la configuración del Agente.`,
            variant: "destructive",
            duration: 7000,
        });
        return;
    }

    const newUserMessage: ChatMessage = { role: 'user', content: currentMessage };
    setChatHistory(prev => [...prev, newUserMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setChatError(null);

    const messagesForApi = [...chatHistory, newUserMessage];

    // Use the resolved LLM options
    const result = await handleChatCompletion(
        messagesForApi,
        options.providerId,
        options.apiKey,
        options.modelName,
        options.apiUrl
    );

    if (result.success && result.data) {
      const assistantMessage: ChatMessage = { role: 'assistant', content: result.data.content };
      setChatHistory(prev => [...prev, assistantMessage]);
    } else {
      setChatError(result.error || 'Ocurrió un error desconocido durante la respuesta del chat.');
      toast({
        title: 'Error en el Chat',
        description: result.error || `No se pudo obtener una respuesta de ${options.providerId}.`,
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
    toast({ title: 'Chat Borrado', description: 'El historial de chat ha sido limpiado.' });
  };

   const getSourceName = (sourceId: string): string => {
    if (sourceId === 'global') return 'Global';
    return agents.find(a => a.id === sourceId)?.name || 'Desconocido';
  }


  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)] gap-6">
      <Card className="shadow-lg flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Chat con IA
          </CardTitle>
          <CardDescription>
            Interactúa con el asistente de IA usando la configuración LLM seleccionada. Puedes hacer preguntas, pedir explicaciones de código, generar ideas, etc.
            {!resolvedLlmOptions && selectedConfigSource ? (
                 <span className="text-destructive block mt-1"> (Configuración LLM para '{getSourceName(selectedConfigSource)}' incompleta o inválida)</span>
             ) : resolvedLlmOptions ? (
                <span className="text-foreground block mt-1">(Usando: {getSourceName(selectedConfigSource)} - {resolvedLlmOptions.providerId} - {resolvedLlmOptions.modelName})</span>
             ) : (
                 <span className="text-muted-foreground block mt-1">(Selecciona una fuente de configuración)</span>
             )}
          </CardDescription>
           {/* LLM Configuration Source Selector */}
            <div className="space-y-1 pt-3">
                <Label htmlFor="configSource" className="text-sm text-muted-foreground flex items-center gap-1">
                   <Settings2 className="h-4 w-4"/> Usar Configuración LLM De:
                </Label>
                <Select onValueChange={setSelectedConfigSource} value={selectedConfigSource}>
                    <SelectTrigger id="configSource" className="w-full md:w-1/2 h-9 text-xs">
                        <SelectValue placeholder="Seleccionar fuente de configuración" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="global">Ajustes Globales</SelectItem>
                        {agents.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>
                                Agente: {agent.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 {!resolvedLlmOptions && selectedConfigSource && (
                     <p className="text-xs text-destructive mt-1">La configuración para '{getSourceName(selectedConfigSource)}' parece incompleta. Revisa los Ajustes o la configuración del agente.</p>
                )}
            </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4 md:p-6" ref={scrollAreaRef}>
            <div className="space-y-6">
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
                    className={`max-w-[70%] p-3 rounded-lg shadow ${
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
        </CardContent>

        {chatError && (
          <div className="p-4 border-t border-destructive bg-destructive/10">
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

        <CardFooter className="border-t p-4">
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
              placeholder="Escribe tu mensaje aquí... (Shift+Enter para nueva línea)"
              rows={1}
              className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm bg-card"
              disabled={isLoading || !resolvedLlmOptions}
            />
            <Button onClick={handleClearChat} variant="ghost" size="icon" disabled={isLoading || chatHistory.length === 0} title="Limpiar Chat">
              <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive"/>
            </Button>
            <Button onClick={handleSendMessage} disabled={isLoading || !currentMessage.trim() || !resolvedLlmOptions} className="h-10">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              <span className="sr-only">Enviar</span>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
