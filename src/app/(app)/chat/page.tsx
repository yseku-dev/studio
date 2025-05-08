
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, User, Sparkles, AlertTriangle, Copy, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { handleChatCompletion } from './actions';
import type { ChatMessage } from '@/services/groq'; 
import {
  DEFAULT_LLM_PROVIDER,
  LLM_PROVIDERS,
  type LLMProviderId,
  getLocalStorageApiKeyName,
  getLocalStorageModelName,
  LOCALSTORAGE_PROVIDER_ID_KEY
} from '@/config/llm-config';

export default function ChatPage() {
  // LLM settings state
  const [llmProviderId, setLlmProviderId] = useState<LLMProviderId>(DEFAULT_LLM_PROVIDER);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const loadLLMSettings = useCallback(() => {
    const storedProviderId = localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null;
    const provider = LLM_PROVIDERS.find(p => p.id === (storedProviderId || DEFAULT_LLM_PROVIDER)) || LLM_PROVIDERS.find(p => p.id === DEFAULT_LLM_PROVIDER)!;
    setLlmProviderId(provider.id);
    
    setApiKey(localStorage.getItem(getLocalStorageApiKeyName(provider.id)));
    setModelName(localStorage.getItem(getLocalStorageModelName(provider.id)));
    setApiUrl(localStorage.getItem(`codealchemist_apiurl_${provider.id}`) || provider.apiUrl);
  }, []);

  useEffect(() => {
    loadLLMSettings();
    // Consider loading chat history from localStorage if persistence is desired
    // Listen for storage changes to update settings if modified in another tab
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key?.startsWith('codealchemist_')) {
        loadLLMSettings();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadLLMSettings]);

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
    const currentProviderConfig = LLM_PROVIDERS.find(p => p.id === llmProviderId);

    if (!currentProviderConfig) {
      toast({ title: 'Error de Configuración', description: 'Proveedor LLM no encontrado.', variant: 'destructive' });
      return;
    }
    if (currentProviderConfig.requiresApiKey && !apiKey) {
      toast({ title: 'Configuración Faltante', description: `Por favor, establece tu Clave API para ${currentProviderConfig.name} en Configuración.`, variant: 'destructive' });
      return;
    }
    if (!modelName) {
      toast({ title: 'Configuración Faltante', description: `Por favor, establece el Nombre de Modelo para ${currentProviderConfig.name} en Configuración.`, variant: 'destructive' });
      return;
    }

    const newUserMessage: ChatMessage = { role: 'user', content: currentMessage };
    setChatHistory(prev => [...prev, newUserMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setChatError(null);

    const messagesForApi = [...chatHistory, newUserMessage];

    const result = await handleChatCompletion(messagesForApi, llmProviderId, apiKey!, modelName!, apiUrl);

    if (result.success && result.data) {
      const assistantMessage: ChatMessage = { role: 'assistant', content: result.data.content };
      setChatHistory(prev => [...prev, assistantMessage]);
    } else {
      setChatError(result.error || 'Ocurrió un error desconocido durante la respuesta del chat.');
      toast({
        title: 'Error en el Chat',
        description: result.error || `No se pudo obtener una respuesta de ${currentProviderConfig.name}.`,
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
  
  const currentProviderConfig = LLM_PROVIDERS.find(p => p.id === llmProviderId);
  const isConfigComplete = currentProviderConfig && modelName && (!currentProviderConfig.requiresApiKey || apiKey);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)] gap-6">
      <Card className="shadow-lg flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Chat con IA
          </CardTitle>
          <CardDescription>
            Interactúa con el asistente de IA. Puedes hacer preguntas, pedir explicaciones de código, generar ideas, etc.
            {!isConfigComplete ? (
                <span className="text-destructive block mt-1"> (Configuración de LLM incompleta en Ajustes)</span>
            ) : <span className="text-foreground block mt-1">(Usando Proveedor: {currentProviderConfig?.name}, Modelo: {modelName})</span>}
          </CardDescription>
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
              disabled={isLoading || !isConfigComplete}
            />
            <Button onClick={handleClearChat} variant="ghost" size="icon" disabled={isLoading || chatHistory.length === 0} title="Limpiar Chat">
              <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive"/>
            </Button>
            <Button onClick={handleSendMessage} disabled={isLoading || !currentMessage.trim() || !isConfigComplete} className="h-10">
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
