// src/components/workgroup-execution-modal.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Play, Bot, Terminal, Clipboard, StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WorkgroupConfig, AgentConfig, AgentLLMConfig } from '@/types/agent';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { handleWorkgroupTurn } from '@/app/(app)/workgroups/actions'; // Import the server action
import type { WorkgroupTurnPayload, WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions'; // Import types
import type { ChatMessage } from '@/services/groq';
import {
    DEFAULT_LLM_PROVIDER,
    LLM_PROVIDERS,
    type LLMProviderId,
    getLocalStorageApiKeyName,
    getLocalStorageModelName,
    LOCALSTORAGE_PROVIDER_ID_KEY
} from '@/config/llm-config';

interface WorkgroupExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  workgroup: WorkgroupConfig;
  agents: AgentConfig[]; // Pass available agents to find names and orchestrator
}

const ORCHESTRATOR_AGENT_NAME = "OrquestadorFlujoAgentes";
const MAX_TURNS = 10; // Limit the number of turns to prevent infinite loops

type LogEntry = {
    timestamp: string;
    type: 'info' | 'agent' | 'error' | 'orchestrator' | 'system' | 'debug';
    agentName?: string; // Name of the agent speaking or being called
    message: string;
    llmRequest?: any; // Store parts of the request if needed for debug
    llmResponse?: any; // Store parts of the response if needed for debug
};

export function WorkgroupExecutionModal({ isOpen, onClose, workgroup, agents }: WorkgroupExecutionModalProps) {
  const [executionLogs, setExecutionLogs] = useState<LogEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentTurnInternal, setCurrentTurnInternal] = useState(0); // Use internal state for tracking
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const executionControllerRef = useRef<AbortController | null>(null); // To allow cancelling
  const { toast } = useToast();

  const orchestrator = agents.find(a => a.id === workgroup.agentIds.find(id => agents.find(a => a.id === id)?.name === ORCHESTRATOR_AGENT_NAME));
  const participantAgents = agents.filter(a => workgroup.agentIds.includes(a.id) && a.id !== orchestrator?.id);

  const logMessage = useCallback((logEntry: Omit<LogEntry, 'timestamp'>) => {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
    setExecutionLogs(prev => [...prev, { ...logEntry, timestamp }]);
  }, []);

  const getAgentById = useCallback((agentId: string): AgentConfig | undefined => {
    return agents.find(a => a.id === agentId);
  }, [agents]);


  const resolveAgentLLMOptions = useCallback((agentConfig: AgentLLMConfig): { providerId: LLMProviderId; modelName: string; apiKey: string | null, apiUrl: string | undefined } | null => {
        let providerId: LLMProviderId;
        let modelName: string | null;
        let apiKey: string | null = null;
        let apiUrl: string | undefined;
        let providerConfig = null;

        if (agentConfig === 'default') {
            const globalProviderId = localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null || DEFAULT_LLM_PROVIDER;
            providerConfig = LLM_PROVIDERS.find(p => p.id === globalProviderId);
            modelName = localStorage.getItem(getLocalStorageModelName(globalProviderId));
            apiKey = localStorage.getItem(getLocalStorageApiKeyName(globalProviderId));
            apiUrl = localStorage.getItem(`codealchemist_apiurl_${globalProviderId}`) || providerConfig?.apiUrl;
            providerId = globalProviderId;
        } else {
            providerId = agentConfig.providerId;
            providerConfig = LLM_PROVIDERS.find(p => p.id === providerId);
            modelName = agentConfig.modelName;
            // Use agent's specific key/URL if provided, otherwise fallback to global for that provider, then provider default
            apiKey = agentConfig.apiKey || localStorage.getItem(getLocalStorageApiKeyName(providerId));
            apiUrl = agentConfig.apiUrl || localStorage.getItem(`codealchemist_apiurl_${providerId}`) || providerConfig?.apiUrl;
        }

         if (!providerConfig || !modelName || (providerConfig.requiresApiKey && !apiKey)) {
            logMessage({ type: 'error', message: `Configuración LLM inválida o incompleta para un agente (Proveedor: ${providerId}, Modelo: ${modelName}, API Key requerida: ${providerConfig?.requiresApiKey}). Revisa la configuración global y del agente.` });
            return null;
        }

        return { providerId, modelName, apiKey, apiUrl };
   }, [logMessage]);


  const runExecutionTurn = useCallback(async (turnNumber: number, currentHistory: ChatMessage[], signal: AbortSignal) => {
    // Use passed turnNumber and currentHistory instead of possibly stale state
    logMessage({ type: 'system', message: `Iniciando turno ${turnNumber}/${MAX_TURNS}...` });

     if (!orchestrator) {
        logMessage({ type: 'error', message: 'Error crítico: Agente Orquestrador no encontrado.' });
        throw new Error('Orquestador no encontrado');
    }

    const orchestratorLlmOptions = resolveAgentLLMOptions(orchestrator.llmConfig);
    if (!orchestratorLlmOptions) {
        throw new Error(`Configuración LLM inválida para el Orquestrador (${orchestrator.name})`);
    }

    const participantAgentConfigs = participantAgents.reduce((acc, agent) => {
        const llmOptions = resolveAgentLLMOptions(agent.llmConfig);
        if (llmOptions) {
            acc[agent.id] = {
                id: agent.id,
                name: agent.name,
                systemMessage: agent.systemMessage,
                llmProviderId: llmOptions.providerId,
                llmModelName: llmOptions.modelName,
                llmApiKey: llmOptions.apiKey,
                llmApiUrl: llmOptions.apiUrl
            };
        } else {
             logMessage({ type: 'error', message: `Omitiendo agente ${agent.name} debido a configuración LLM inválida.` });
        }
        return acc;
    }, {} as WorkgroupTurnPayload['participantAgentConfigs']);


    if (Object.keys(participantAgentConfigs).length === 0) {
        throw new Error("No hay agentes participantes con configuración LLM válida.");
    }

    const payload: WorkgroupTurnPayload = {
      workgroupName: workgroup.name,
      task: workgroup.task,
      conversationHistory: currentHistory, // Use the passed history
      orchestrator: {
          id: orchestrator.id,
          name: orchestrator.name,
          systemMessage: orchestrator.systemMessage,
          llmProviderId: orchestratorLlmOptions.providerId,
          llmModelName: orchestratorLlmOptions.modelName,
          llmApiKey: orchestratorLlmOptions.apiKey,
          llmApiUrl: orchestratorLlmOptions.apiUrl
      },
      participantAgentConfigs: participantAgentConfigs,
      currentTurn: turnNumber, // Use the passed turn number
      maxTurns: MAX_TURNS
    };

    logMessage({ type: 'debug', message: `Enviando payload al servidor para el turno ${turnNumber}`, llmRequest: { orchestratorModel: payload.orchestrator.llmModelName, numParticipants: Object.keys(payload.participantAgentConfigs).length, historyLength: payload.conversationHistory.length } });


    try {
        const result: WorkgroupTurnResponse = await handleWorkgroupTurn(payload);

        // Log server-side logs first
        if (result.serverLogs && result.serverLogs.length > 0) {
            result.serverLogs.forEach(log => {
                 // Attempt to parse server log format
                 const match = log.match(/^\[(.*?)\] \[(.*?)\] (.*)$/);
                 if (match) {
                     const [, timestamp, type, message] = match;
                     logMessage({
                         timestamp: timestamp, // Use server timestamp
                         type: type.toLowerCase() as LogEntry['type'] || 'debug',
                         message: message,
                     });
                 } else {
                     logMessage({ type: 'debug', message: `[SERVER] ${log}` }); // Log raw if format unknown
                 }
            });
        }


        if (result.error) {
          logMessage({ type: 'error', message: `Error en el servidor durante el turno ${turnNumber}: ${result.error}` });
          setExecutionError(result.error);
          setIsExecuting(false);
          return; // Stop execution on server error
        }

        // Update conversation history from server response
        const nextHistory = result.updatedHistory || currentHistory;
        setConversationHistory(nextHistory); // Update the state for the UI and the next potential start

        // Log the detailed interactions if provided (optional, could make logs very long)
         if (result.orchestratorDecision) {
             logMessage({ type: 'orchestrator', agentName: orchestrator.name, message: `Decisión: ${result.orchestratorDecision.reason}. Próximo agente: ${getAgentById(result.orchestratorDecision.nextAgentId)?.name || result.orchestratorDecision.nextAgentId}.`, llmResponse: { raw: result.orchestratorDecision.rawOutput?.substring(0,100) } });
         }
         if (result.agentResponse) {
             logMessage({ type: 'agent', agentName: getAgentById(result.agentResponse.agentId)?.name || result.agentResponse.agentId, message: `Respuesta: ${result.agentResponse.content.substring(0, 200)}...`, llmResponse: { raw: result.agentResponse.rawOutput?.substring(0,100) } });
         }

        // Update the internal turn state for the UI
        setCurrentTurnInternal(turnNumber);

        if (result.isComplete || turnNumber >= MAX_TURNS) {
            logMessage({ type: 'system', message: `Ejecución completada (Razón: ${result.isComplete ? 'Tarea completada por orquestador' : 'Límite de turnos alcanzado'}).` });
            setIsExecuting(false);
        } else if (!signal.aborted) {
            // Schedule next turn after a short delay
             await new Promise(resolve => setTimeout(resolve, 1500)); // Delay between turns
             if (!signal.aborted) {
                 // Make the recursive call with the *next* turn number and the *updated* history
                 runExecutionTurn(turnNumber + 1, nextHistory, signal);
             } else {
                  logMessage({ type: 'system', message: 'Ejecución cancelada por el usuario.' });
                  setIsExecuting(false);
             }
        } else {
             logMessage({ type: 'system', message: 'Ejecución cancelada por el usuario durante la espera.' });
             setIsExecuting(false);
        }

    } catch (error) {
       if (error instanceof Error && error.name === 'AbortError') {
            logMessage({ type: 'system', message: 'Ejecución cancelada por el usuario.' });
        } else {
            const errorMsg = error instanceof Error ? error.message : 'Error desconocido al procesar el turno.';
            logMessage({ type: 'error', message: `Error en el cliente durante el turno ${turnNumber}: ${errorMsg}` });
            setExecutionError(errorMsg);
        }
        setIsExecuting(false); // Stop execution on client error or cancellation
    }

  }, [orchestrator, resolveAgentLLMOptions, participantAgents, workgroup.name, workgroup.task, logMessage, getAgentById]); // Removed conversationHistory and currentTurn from deps


  const startExecution = useCallback(() => {
    if (isExecuting) return;
    setIsExecuting(true);
    setExecutionLogs([]);
    const initialHistory: ChatMessage[] = []; // Start with empty history
    setConversationHistory(initialHistory);
    setCurrentTurnInternal(0); // Reset internal turn counter
    setExecutionError(null);
    executionControllerRef.current = new AbortController(); // Create new controller for this run

    logMessage({ type: 'system', message: `Iniciando ejecución del grupo de trabajo "${workgroup.name}"...` });
    logMessage({ type: 'info', message: `Tarea: ${workgroup.task}` });
    logMessage({ type: 'info', message: `Orquestador: ${orchestrator?.name}` });
    logMessage({ type: 'info', message: `Participantes: ${participantAgents.map(a => a.name).join(', ')}` });
    logMessage({ type: 'info', message: `Máximo de turnos: ${MAX_TURNS}` });

    // Start the first turn, passing turn number 1 and the initial empty history
    runExecutionTurn(1, initialHistory, executionControllerRef.current.signal);

  }, [isExecuting, workgroup.name, workgroup.task, orchestrator, participantAgents, logMessage, runExecutionTurn]);


  // Start execution when modal opens
  useEffect(() => {
    if (isOpen) {
      startExecution();
    } else {
        // Cleanup if modal is closed while executing
        if (executionControllerRef.current) {
            executionControllerRef.current.abort();
            executionControllerRef.current = null;
        }
         setIsExecuting(false); // Ensure execution stops
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Trigger simulation when modal opens


  // Scroll to bottom when logs update
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [executionLogs]);

  const handleCopyLogs = () => {
    const logText = executionLogs.map(log => `${log.timestamp} ${log.type.toUpperCase()}${log.agentName ? ` (${log.agentName})` : ''}: ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText)
      .then(() => toast({ title: 'Logs Copiados', description: 'Los logs de ejecución han sido copiados.' }))
      .catch(() => toast({ title: 'Error al Copiar', description: 'No se pudieron copiar los logs.', variant: 'destructive' }));
  };

  const handleStopExecution = () => {
      if (executionControllerRef.current) {
          executionControllerRef.current.abort(); // Signal cancellation
          logMessage({type: 'system', message: 'Solicitando cancelación de la ejecución...'});
      }
      setIsExecuting(false); // Update state immediately
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-4xl lg:max-w-6xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            {isExecuting ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Play className="h-5 w-5 text-primary" />}
            Ejecución del Grupo: {workgroup.name} {isExecuting ? `(Turno ${currentTurnInternal}/${MAX_TURNS})` : '(Finalizado)'}
          </DialogTitle>
          <DialogDescription>
            Observa el flujo de trabajo entre los agentes mientras colaboran en la tarea.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col gap-4">
           {/* Task Display */}
           <Card className='bg-muted/30 border-primary/20 flex-shrink-0 max-h-[100px] overflow-y-auto'>
              <CardHeader className='p-3 sticky top-0 bg-muted/50 z-10'>
                <CardTitle className='text-sm font-medium text-primary'>Tarea Principal</CardTitle>
              </CardHeader>
               <CardContent className='p-3 pt-0'>
                   <p className='text-xs text-foreground'>{workgroup.task}</p>
               </CardContent>
           </Card>

           {/* Log Area */}
           <div className="flex-1 border rounded-md p-1 flex flex-col bg-card min-h-0">
                <div className='flex justify-between items-center p-2 border-b mb-1 sticky top-0 bg-card z-10'>
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <Terminal className='h-4 w-4 text-muted-foreground'/>
                        Log de Ejecución Detallado
                    </h3>
                    <Button variant="outline" size="sm" onClick={handleCopyLogs} disabled={executionLogs.length === 0}>
                        <Clipboard className='mr-1 h-3 w-3'/> Copiar Logs
                    </Button>
                </div>
                <ScrollArea className="flex-1 p-2" ref={scrollAreaRef}>
                    <pre className="text-xs text-foreground whitespace-pre-wrap break-words">
                        {executionLogs.map((log, index) => {
                             const isOrchestrator = log.type === 'orchestrator';
                             const isError = log.type === 'error';
                             const isAgent = log.type === 'agent';
                             const isSystem = log.type === 'system';
                             const isDebug = log.type === 'debug';
                             const isInfo = log.type === 'info';

                            return (
                                <div key={index} className={cn(
                                     "mb-1 p-1 rounded-sm",
                                     isOrchestrator && "bg-accent/10",
                                     isAgent && "bg-primary/5",
                                     isError && "bg-destructive/10 text-destructive",
                                     isSystem && "bg-muted/50 italic",
                                     isDebug && "opacity-60"
                                )}>
                                    <span className="font-mono text-muted-foreground mr-2">{log.timestamp}</span>
                                     <span className={cn(
                                        "font-semibold",
                                        isOrchestrator && "text-accent",
                                        isAgent && "text-primary",
                                        isError && "text-destructive",
                                        isSystem && "text-muted-foreground"
                                     )}>
                                        {log.type.toUpperCase()}{log.agentName ? ` (${log.agentName})` : ''}:
                                     </span>
                                     <span className="ml-1">{log.message}</span>
                                     {/* Optionally display raw LLM request/response in debug mode? */}
                                     {/* {isDebug && log.llmRequest && <details><summary>Req</summary>{JSON.stringify(log.llmRequest)}</details>} */}
                                     {/* {isDebug && log.llmResponse && <details><summary>Res</summary>{JSON.stringify(log.llmResponse)}</details>} */}
                                </div>
                             )
                        })}
                        {isExecuting && <div className="flex items-center gap-2 mt-2"><Loader2 className="h-4 w-4 animate-spin text-primary inline-block" /><span className='text-sm text-muted-foreground'>Procesando turno...</span></div>}
                         {!isExecuting && executionError && <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm font-medium">Ejecución detenida debido a un error.</div>}
                         {!isExecuting && !executionError && currentTurnInternal >= MAX_TURNS && <div className="mt-2 p-2 rounded bg-primary/10 text-primary text-sm font-medium">Ejecución completada (Límite de turnos alcanzado).</div>}
                         {!isExecuting && !executionError && currentTurnInternal < MAX_TURNS && executionLogs.length > 0 && <div className="mt-2 p-2 rounded bg-primary/10 text-primary text-sm font-medium">Ejecución completada o detenida antes del límite de turnos.</div>}
                    </pre>
                </ScrollArea>
           </div>
        </div>

        <DialogFooter className="p-4 pt-4 border-t">
             {isExecuting && (
                 <Button variant="destructive" onClick={handleStopExecution}>
                    <StopCircle className='mr-2 h-4 w-4'/> Detener Ejecución
                 </Button>
             )}
          <DialogClose asChild>
            <Button type="button" variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}