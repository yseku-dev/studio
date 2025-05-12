
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, User, Sparkles, AlertTriangle, Copy, Trash2, Settings2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { handleChatCompletion, initiateWorkgroupChat } from './actions'; 
import type { ChatMessage } from '@/services/groq';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import type { LLMOptions } from '@/services/groq';
import { LOCALSTORAGE_AGENTS_KEY, LOCALSTORAGE_WORKGROUPS_KEY } from '@/config/agent-config';
import { LLM_PROVIDERS, LOCALSTORAGE_PROVIDER_ID_KEY, getLocalStorageApiKeyName, getLocalStorageModelName, type LLMProviderId } from '@/config/llm-config';
import { useDebug } from '@/contexts/DebugContext';

export default function ChatPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { addDebugLog } = useDebug();
  const isMountedRef = useRef(false);

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global');
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    isMountedRef.current = true;
    addDebugLog({ source: 'CHAT_PAGE', type: 'INFO', message: 'Componente ChatPage montado.' });
    return () => { 
      isMountedRef.current = false; 
      addDebugLog({ source: 'CHAT_PAGE', type: 'INFO', message: 'Componente ChatPage desmontado.' });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addServerLogsToDebug = useCallback((serverLogs: string[] | undefined, sourcePrefix: string = 'SERVER_CHAT') => {
    if (isMountedRef.current && serverLogs) {
        serverLogs.forEach(logMsg => {
            const match = logMsg.match(/^\[(.*?)\]\s\[(.*?)\]\s(.*?)(?:\s\|\sData:\s(.*))?$/);
            if (match) {
                const [, timestamp, type, message, dataStr] = match;
                let data: any = undefined;
                if (dataStr) {
                    try { data = JSON.parse(dataStr); } catch { data = dataStr; }
                }
                addDebugLog({ source: sourcePrefix, type: type.toUpperCase() as any, message, data });
            } else {
                addDebugLog({ source: sourcePrefix, type: 'INFO', message: logMsg });
            }
        });
    }
  }, [addDebugLog]);

  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try { setAgents(JSON.parse(storedAgents)); } catch (e) { console.error("Error parsing stored agents:", e); setAgents([]); addDebugLog({source: 'CHAT_PAGE', type: 'ERROR', message: 'Error al parsear agentes de localStorage.', data: e});}
    }
    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
      try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); addDebugLog({source: 'CHAT_PAGE', type: 'ERROR', message: 'Error al parsear grupos de localStorage.', data: e});}
    }
  }, [addDebugLog]);

  useEffect(() => {
    const options = resolveLlmOptionsForSource(selectedConfigSource, agents, workgroups);
    setResolvedLlmOptions(options);
    addDebugLog({ source: 'CHAT_PAGE', type: 'DEBUG', message: `Opciones LLM resueltas para ${selectedConfigSource}`, data: options });
  }, [selectedConfigSource, agents, workgroups, addDebugLog]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) { scrollViewport.scrollTop = scrollViewport.scrollHeight; }
    }
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;
    
    let result;
    const newUserMessage: ChatMessage = { role: 'user', content: currentMessage };
    setChatHistory(prev => [...prev, newUserMessage]);
    const messagesForApi = [...chatHistory, newUserMessage]; 
    setCurrentMessage('');
    setIsLoading(true);
    setChatError(null);
    addDebugLog({ source: 'CHAT_PAGE', type: 'INFO', message: `Enviando mensaje: "${newUserMessage.content.substring(0,50)}..." usando ${getSourceName(selectedConfigSource)}`});

    if (selectedConfigSource.startsWith('workgroup:')) {
      const workgroupId = selectedConfigSource.split(':')[1];
      const workgroup = workgroups.find(wg => wg.id === workgroupId);
      if (!workgroup) {
        toast({ title: "Error de Grupo", description: "Grupo de trabajo no encontrado.", variant: "destructive"});
        addDebugLog({ source: 'CHAT_PAGE', type: 'ERROR', message: `Grupo de trabajo ${workgroupId} no encontrado.`});
        setIsLoading(false);
        setChatHistory(prev => prev.slice(0, -1)); // Remove user message if group not found
        return;
      }
      
      const snapshot: LocalStorageSnapshot = {
        [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
        apiKeys: {},
        modelNames: {},
        apiUrls: {},
      };
      LLM_PROVIDERS.forEach(provider => {
        snapshot.apiKeys[provider.id] = localStorage.getItem(getLocalStorageApiKeyName(provider.id));
        snapshot.modelNames[provider.id] = localStorage.getItem(getLocalStorageModelName(provider.id));
        snapshot.apiUrls[provider.id] = localStorage.getItem(`codealchemist_apiurl_${provider.id}`);
      });
      addDebugLog({ source: 'CHAT_PAGE', type: 'DEBUG', message: 'Snapshot de localStorage enviado para chat de grupo.'});

      result = await initiateWorkgroupChat(messagesForApi, workgroupId, agents, workgroups, snapshot);
      addServerLogsToDebug(result.workgroupLogs, 'SERVER_WG_CHAT');
    } else {
        const options = resolvedLlmOptions;
        if (!options) {
             toast({
                title: "Configuración LLM Incompleta",
                description: `La configuración LLM seleccionada (${getSourceName(selectedConfigSource)}) está incompleta.`,
                variant: "destructive",
                duration: 7000,
            });
            addDebugLog({ source: 'CHAT_PAGE', type: 'ERROR', message: `Configuración LLM para '${getSourceName(selectedConfigSource)}' incompleta.`});
            setIsLoading(false);
            setChatHistory(prev => prev.slice(0, -1)); // Remove user message
            return;
        }
        result = await handleChatCompletion(messagesForApi, options.providerId, options.apiKey, options.modelName, options.apiUrl);
    }


    if (result.success && result.data) {
      const assistantMessage: ChatMessage = { role: 'assistant', content: result.data.content };
      setChatHistory(prev => [...prev, assistantMessage]);
      addDebugLog({ source: 'CHAT_PAGE', type: 'INFO', message: `Respuesta recibida: "${assistantMessage.content.substring(0,50)}..."`});
    } else {
      setChatError(result.error || 'Ocurrió un error desconocido.');
      toast({ title: 'Error en Chat', description: result.error || `No se pudo obtener respuesta.`, variant: 'destructive' });
      addDebugLog({ source: 'CHAT_PAGE', type: 'ERROR', message: `Error en chat: ${result.error || 'Desconocido'}`, data:result});
      // Optionally remove the user message that led to an error: setChatHistory(prev => prev.slice(0, -1));
    }
    setIsLoading(false);
  };

  const handleCopyError = (errorText: string | undefined) => {
    if (!errorText) return;
    navigator.clipboard.writeText(errorText)
      .then(() => toast({ title: 'Error Copiado', description: 'Error copiado.' }))
      .catch(err => toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar error.', variant: 'destructive' }));
  };

  const handleClearChat = () => {
    setChatHistory([]);
    setChatError(null);
    toast({ title: 'Chat Borrado', description: 'Historial de chat limpiado.' });
    addDebugLog({ source: 'CHAT_PAGE', type: 'INFO', message: 'Historial de chat limpiado.'});
  };

   const getSourceName = (sourceId: string): string => {
    if (sourceId === 'global') return 'Global';
    if (sourceId.startsWith('agent:')) {
      const agentId = sourceId.split(':')[1];
      return agents.find(a => a.id === agentId)?.name || `Agente ${agentId.substring(0,6)}...`;
    }
    if (sourceId.startsWith('workgroup:')) {
      const workgroupId = sourceId.split(':')[1];
      return workgroups.find(wg => wg.id === workgroupId)?.name || `Grupo ${workgroupId.substring(0,6)}...`;
    }
    return 'Desconocido';
  };
  
  const isWorkgroupSelected = selectedConfigSource.startsWith('workgroup:');
  // Disable send button if loading, message is empty, OR (not workgroup AND no LLM options) OR (workgroup AND no workgroups exist)
  const isSendButtonDisabled = isLoading || !currentMessage.trim() || (!isWorkgroupSelected && !resolvedLlmOptions) || (isWorkgroupSelected && workgroups.length === 0);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)] gap-6">
      <Card className="shadow-lg flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Chat con IA
          </CardTitle>
          <CardDescription>
            Interactúa con el asistente IA usando la configuración LLM seleccionada.
            {!resolvedLlmOptions && !isWorkgroupSelected && selectedConfigSource ? (
                 <span className="text-destructive block mt-1"> (Configuración para '{getSourceName(selectedConfigSource)}' incompleta)</span>
             ) : resolvedLlmOptions && !isWorkgroupSelected ? (
                <span className="text-foreground block mt-1">(Usando: {getSourceName(selectedConfigSource)} - {resolvedLlmOptions.providerId} - {resolvedLlmOptions.modelName})</span>
             ) : isWorkgroupSelected ? (
                <span className="text-foreground block mt-1">(Usando Grupo: {getSourceName(selectedConfigSource)})</span>
             ) : (
                 <span className="text-muted-foreground block mt-1">(Selecciona fuente de configuración)</span>
             )}
          </CardDescription>
            <div className="space-y-1 pt-3">
                <Label htmlFor="configSourceChat" className="text-sm text-muted-foreground flex items-center gap-1"><Settings2 className="h-4 w-4"/> Usar Configuración LLM De:</Label>
                <Select onValueChange={setSelectedConfigSource} value={selectedConfigSource}>
                    <SelectTrigger id="configSourceChat" className="w-full md:w-1/2 h-9 text-xs"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="global">Ajustes Globales</SelectItem>
                        {agents.map(agent => <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>Agente: {agent.name}</SelectItem>)}
                        {workgroups.map(wg => <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>Grupo: {wg.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                 {!resolvedLlmOptions && !isWorkgroupSelected && selectedConfigSource && (
                     <p className="text-xs text-destructive mt-1">Configuración para '{getSourceName(selectedConfigSource)}' incompleta. Revisa Ajustes, Agentes o Grupos.</p>
                )}
            </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4 md:p-6" ref={scrollAreaRef}>
            <div className="space-y-6">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (<Avatar className="h-8 w-8 border border-primary/50"><AvatarFallback className="bg-primary/20 text-primary"><Sparkles className="h-5 w-5" /></AvatarFallback></Avatar>)}
                  <div className={`max-w-[70%] p-3 rounded-lg shadow ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card text-card-foreground border rounded-bl-none'}`}>
                    <pre className="text-sm whitespace-pre-wrap break-words">{msg.content}</pre>
                  </div>
                  {msg.role === 'user' && (<Avatar className="h-8 w-8 border border-muted-foreground/50"><AvatarFallback className="bg-muted/30 text-muted-foreground"><User className="h-5 w-5" /></AvatarFallback></Avatar>)}
                </div>
              ))}
              {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length -1].role === 'user' && (
                 <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 border border-primary/50"><AvatarFallback className="bg-primary/20 text-primary"><Sparkles className="h-5 w-5" /></AvatarFallback></Avatar>
                    <div className="max-w-[70%] p-3 rounded-lg shadow bg-card text-card-foreground border rounded-bl-none"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                 </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        {chatError && (
          <div className="p-4 border-t border-destructive bg-destructive/10">
            <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Error:</p>
                <Button variant="ghost" size="icon" onClick={() => handleCopyError(chatError)} title="Copiar Error"><Copy className="h-4 w-4 text-destructive" /></Button>
            </div>
            <p className="text-xs text-destructive">{chatError}</p>
          </div>
        )}

        <CardFooter className="border-t p-4">
          <div className="flex w-full items-center gap-2">
            <Textarea value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
              placeholder="Escribe tu mensaje... (Shift+Enter para nueva línea)" rows={1}
              className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm bg-card" 
              disabled={isLoading} // Only disable textarea when actively loading a response
            />
            <Button onClick={handleClearChat} variant="ghost" size="icon" disabled={isLoading || chatHistory.length === 0} title="Limpiar Chat">
              <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive"/>
            </Button>
            <Button onClick={handleSendMessage} disabled={isSendButtonDisabled} className="h-10">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              <span className="sr-only">Enviar</span>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
