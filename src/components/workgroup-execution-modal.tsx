
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
import { handleWorkgroupTurn } from '@/app/(app)/workgroups/actions'; 
import type { WorkgroupTurnPayload, WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions'; 
import type { ChatMessage } from '@/services/groq';
import {
    DEFAULT_LLM_PROVIDER,
    LLM_PROVIDERS,
    type LLMProviderId,
    getLocalStorageApiKeyName,
    getLocalStorageModelName,
    LOCALSTORAGE_PROVIDER_ID_KEY
} from '@/config/llm-config';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS } from '@/config/agent-config'; 
import { resolveLlmOptionsForSource } from '@/lib/llm-utils'; 

interface WorkgroupExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  workgroup: WorkgroupConfig;
  agents: AgentConfig[]; 
  workgroups: WorkgroupConfig[]; 
}

type LogEntry = {
    timestamp: string;
    type: 'info' | 'agent' | 'error' | 'orchestrator' | 'system' | 'debug';
    agentName?: string; 
    message: string;
    llmRequest?: any; 
    llmResponse?: any; 
};

export function WorkgroupExecutionModal({ isOpen, onClose, workgroup, agents, workgroups }: WorkgroupExecutionModalProps) {
  const [executionLogs, setExecutionLogs] = useState<LogEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const isExecutingRef = useRef(false); 
  const [currentTurn, setCurrentTurn] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const executionControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(false);
  const { toast } = useToast();

  const orchestrator = useMemo(() => agents.find(a => a.id === workgroup.agentIds.find(id => agents.find(a => a.id === id)?.name === ORCHESTRATOR_AGENT_NAME)), [agents, workgroup.agentIds]);
  const participantAgents = useMemo(() => agents.filter(a => workgroup.agentIds.includes(a.id) && a.id !== orchestrator?.id), [agents, workgroup.agentIds, orchestrator]);

  const logMessage = useCallback((logEntry: Omit<LogEntry, 'timestamp'>) => {
    if (!isMountedRef.current) return;
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
    setExecutionLogs(prev => [...prev, { ...logEntry, timestamp }]);
  }, []);

  const getAgentById = useCallback((agentId: string): AgentConfig | undefined => {
    return agents.find(a => a.id === agentId);
  }, [agents]);

  const runExecutionTurn = useCallback(async (turn: number, history: ChatMessage[], signal: AbortSignal) => {
    if (!isMountedRef.current || signal.aborted) {
        logMessage({ type: 'system', message: 'Ejecución detenida (Componente desmontado o señal cancelada).' });
        setIsExecuting(false);
        isExecutingRef.current = false;
        return;
    }

    logMessage({ type: 'system', message: `Iniciando turno ${turn}/${MAX_WORKGROUP_TURNS}...` });
    setCurrentTurn(turn);

    if (!orchestrator) {
        logMessage({ type: 'error', message: 'Error crítico: Agente Orquestrador no encontrado.' });
        setExecutionError('Error crítico: Agente Orquestrador no encontrado.');
        setIsExecuting(false);
        isExecutingRef.current = false;
        return;
    }

    const orchestratorLlmOptions = resolveLlmOptionsForSource(`agent:${orchestrator.id}`, agents, workgroups);
    if (!orchestratorLlmOptions) {
        logMessage({ type: 'error', message: `Configuración LLM inválida para el Orquestrador (${orchestrator.name})` });
        setExecutionError(`Configuración LLM inválida para el Orquestrador (${orchestrator.name})`);
        setIsExecuting(false);
        isExecutingRef.current = false;
        return;
    }

    const participantAgentConfigs = participantAgents.reduce((acc, agent) => {
        const llmOptions = resolveLlmOptionsForSource(`agent:${agent.id}`, agents, workgroups);
        if (llmOptions) {
            acc[agent.id] = {
                id: agent.id, name: agent.name, systemMessage: agent.systemMessage,
                llmProviderId: llmOptions.providerId, llmModelName: llmOptions.modelName,
                llmApiKey: llmOptions.apiKey, llmApiUrl: llmOptions.apiUrl
            };
        } else {
            logMessage({ type: 'error', message: `Omitiendo agente ${agent.name} debido a configuración LLM inválida.` });
        }
        return acc;
    }, {} as WorkgroupTurnPayload['participantAgentConfigs']);

    if (Object.keys(participantAgentConfigs).length === 0 && participantAgents.length > 0) {
         logMessage({ type: 'error', message: "No hay agentes participantes con configuración LLM válida." });
         setExecutionError("No hay agentes participantes con configuración LLM válida.");
         setIsExecuting(false);
         isExecutingRef.current = false;
        return;
    }

    const payload: WorkgroupTurnPayload = {
        workgroupName: workgroup.name, task: workgroup.task, conversationHistory: history,
        orchestrator: {
            id: orchestrator.id, name: orchestrator.name, systemMessage: orchestrator.systemMessage,
            llmProviderId: orchestratorLlmOptions.providerId, llmModelName: orchestratorLlmOptions.modelName,
            llmApiKey: orchestratorLlmOptions.apiKey, llmApiUrl: orchestratorLlmOptions.apiUrl
        },
        participantAgentConfigs, currentTurn: turn, maxTurns: MAX_WORKGROUP_TURNS
    };

    logMessage({ type: 'debug', message: `Enviando payload al servidor para el turno ${turn}`, llmRequest: { orchestratorModel: payload.orchestrator.llmModelName, numParticipants: Object.keys(payload.participantAgentConfigs).length, historyLength: payload.conversationHistory.length } });

    try {
        const result: WorkgroupTurnResponse = await handleWorkgroupTurn(payload);

        if (result.serverLogs && result.serverLogs.length > 0) {
            result.serverLogs.forEach(log => {
                const match = log.match(/^\[(.*?)\] \[(.*?)\] (.*)$/);
                if (match) {
                    const [, timestamp, type, messageData] = match;
                    let message = messageData;
                    let data;
                    const dataSplit = messageData.split(' | Data: ');
                    if (dataSplit.length > 1) {
                        message = dataSplit[0];
                        try {
                            data = JSON.parse(dataSplit.slice(1).join(' | Data: ')); 
                        } catch {
                            data = {raw: dataSplit.slice(1).join(' | Data: ')}; 
                        }
                    }
                    logMessage({
                        timestamp: timestamp, type: type.toLowerCase() as LogEntry['type'] || 'debug', message,
                        llmResponse: data ? data : undefined,
                    });
                } else {
                    logMessage({ type: 'debug', message: `[SERVER] ${log}` });
                }
            });
        }

        if (result.error) {
            logMessage({ type: 'error', message: `Error en el servidor durante el turno ${turn}: ${result.error}` });
            setExecutionError(result.error);
            setIsExecuting(false);
            isExecutingRef.current = false;
            return;
        }
        
        const updatedHistory = result.updatedHistory || history;
        setConversationHistory(updatedHistory);

        if (result.orchestratorDecision) {
            const nextAgentName = getAgentById(result.orchestratorDecision.nextAgentId)?.name || result.orchestratorDecision.nextAgentId;
            logMessage({ type: 'orchestrator', agentName: orchestrator.name, message: `Decisión: ${result.orchestratorDecision.reason}. Próximo agente: ${nextAgentName}.`, llmResponse: { raw: result.orchestratorDecision.rawOutput } });
        }
        if (result.agentResponse) {
             const respondingAgentName = getAgentById(result.agentResponse.agentId)?.name || result.agentResponse.agentId;
            logMessage({ type: 'agent', agentName: respondingAgentName, message: `Respuesta: ${result.agentResponse.content}`, llmResponse: { raw: result.agentResponse.rawOutput } });
        }

        if (result.isComplete || turn >= MAX_WORKGROUP_TURNS) {
            logMessage({ type: 'system', message: `Ejecución finalizada (Razón: ${result.isComplete ? 'Tarea completada por orquestador' : 'Límite de turnos alcanzado'}).` });
            setIsExecuting(false);
            isExecutingRef.current = false;
        } else if (!signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (!signal.aborted && isMountedRef.current) {
                runExecutionTurn(turn + 1, updatedHistory, signal);
            } else if (signal.aborted) {
                 logMessage({ type: 'system', message: 'Ejecución cancelada por el usuario durante la espera.' });
                 setIsExecuting(false);
                 isExecutingRef.current = false;
            }
        } else {
            logMessage({ type: 'system', message: 'Ejecución cancelada por el usuario.' });
            setIsExecuting(false);
            isExecutingRef.current = false;
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            logMessage({ type: 'system', message: 'Ejecución cancelada por el usuario.' });
        } else {
            const errorMsg = error instanceof Error ? error.message : 'Error desconocido al procesar el turno.';
            logMessage({ type: 'error', message: `Error en el cliente durante el turno ${turn}: ${errorMsg}` });
            setExecutionError(errorMsg);
        }
        setIsExecuting(false);
        isExecutingRef.current = false;
    }
  }, [orchestrator, participantAgents, workgroup.name, workgroup.task, logMessage, getAgentById, agents, workgroups, setExecutionError, setIsExecuting, setConversationHistory]);

  const startExecution = useCallback(() => {
    setIsExecuting(true);
    isExecutingRef.current = true;
    setExecutionLogs([]);
    const initialHistory: ChatMessage[] = [];
    setConversationHistory(initialHistory);
    setCurrentTurn(0);
    setExecutionError(null);
    
    logMessage({ type: 'system', message: `Iniciando ejecución del grupo de trabajo "${workgroup.name}"...` });
    logMessage({ type: 'info', message: `Tarea: ${workgroup.task}` });
    logMessage({ type: 'info', message: `Orquestador: ${orchestrator?.name}` });
    logMessage({ type: 'info', message: `Participantes: ${participantAgents.map(a => a.name).join(', ')}` });
    logMessage({ type: 'info', message: `Máximo de turnos: ${MAX_WORKGROUP_TURNS}` });

    if (executionControllerRef.current) {
        executionControllerRef.current.abort(); 
    }
    executionControllerRef.current = new AbortController();
    runExecutionTurn(1, initialHistory, executionControllerRef.current.signal);
  }, [workgroup.name, workgroup.task, orchestrator, participantAgents, logMessage, runExecutionTurn]);

  useEffect(() => {
    isMountedRef.current = true;
    if (isOpen) {
        if (!isExecutingRef.current) {
            startExecution();
        }
    } else {
        if (isExecutingRef.current) {
            isExecutingRef.current = false; 
            setIsExecuting(false); 
        }
        if (executionControllerRef.current) {
            executionControllerRef.current.abort();
            logMessage({ type: 'system', message: 'Ejecución detenida por cierre de modal.' });
            executionControllerRef.current = null;
        }
    }
    return () => {
        isMountedRef.current = false;
        if (executionControllerRef.current) {
            executionControllerRef.current.abort();
            console.log('[WorkgroupExecutionModal] Execution aborted on unmount.');
            executionControllerRef.current = null;
        }
        isExecutingRef.current = false;
    };
  }, [isOpen, startExecution, logMessage]); 

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [executionLogs]);

  const handleCopyLogs = () => {
    const logText = executionLogs.map(log => `[${log.timestamp}] [${log.type.toUpperCase()}]${log.agentName ? ` (${log.agentName})` : ''}: ${log.message}${log.llmRequest ? `\n  Request: ${JSON.stringify(log.llmRequest, null, 2)}` : ''}${log.llmResponse ? `\n  Response: ${JSON.stringify(log.llmResponse, null, 2)}` : ''}`).join('\n\n');
    navigator.clipboard.writeText(logText)
      .then(() => toast({ title: 'Logs Copiados', description: 'Los logs de ejecución han sido copiados.' }))
      .catch(() => toast({ title: 'Error al Copiar', description: 'No se pudieron copiar los logs.', variant: 'destructive' }));
  };

  const handleStopExecution = () => {
      if (executionControllerRef.current) {
          executionControllerRef.current.abort();
          logMessage({type: 'system', message: 'Solicitando cancelación de la ejecución...'});
      }
      setIsExecuting(false);
      isExecutingRef.current = false;
  };

  const handleDialogEvent = useCallback((open: boolean) => {
      if (!open) {
          onClose();
      }
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogEvent}>
      <DialogContent className="sm:max-w-4xl lg:max-w-6xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            {isExecuting && currentTurn > 0 ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : isExecuting && currentTurn === 0 ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Play className="h-5 w-5 text-primary" /> }
            Ejecución del Grupo: {workgroup.name} {isExecuting && currentTurn > 0 ? `(Turno ${currentTurn}/${MAX_WORKGROUP_TURNS})` : isExecuting && currentTurn === 0 ? '(Iniciando...)' : executionLogs.length > 0 ? '(Finalizado)' : '(Listo para iniciar)'}
          </DialogTitle>
          <DialogDescription>
            Observa el flujo de trabajo entre los agentes mientras colaboran en la tarea.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col gap-4">
           <Card className='bg-muted/30 border-primary/20 flex-shrink-0 max-h-[100px] overflow-y-auto'>
              <CardHeader className='p-3 sticky top-0 bg-muted/50 z-10'>
                <CardTitle className='text-sm font-medium text-primary'>Tarea Principal</CardTitle>
              </CardHeader>
               <CardContent className='p-3 pt-0'>
                   <p className='text-xs text-foreground'>{workgroup.task}</p>
               </CardContent>
           </Card>

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
                                     {(log.llmRequest || log.llmResponse) && (
                                        <details className="mt-1 ml-4 text-[10px] opacity-80 leading-tight">
                                            <summary className="cursor-pointer italic text-muted-foreground">Detalles LLM</summary>
                                            {log.llmRequest && (
                                                <div className="mt-1 p-1 border bg-background rounded max-h-60 overflow-auto">
                                                    <strong className="block text-muted-foreground">Solicitud:</strong>
                                                    <pre className="whitespace-pre-wrap break-all">{typeof log.llmRequest === 'string' ? log.llmRequest : JSON.stringify(log.llmRequest, null, 2)}</pre>
                                                </div>
                                            )}
                                            {log.llmResponse && (
                                                <div className="mt-1 p-1 border bg-background rounded max-h-60 overflow-auto">
                                                    <strong className="block text-muted-foreground">Respuesta:</strong>
                                                    <pre className="whitespace-pre-wrap break-all">{typeof log.llmResponse === 'string' ? log.llmResponse : JSON.stringify(log.llmResponse, null, 2)}</pre>
                                                </div>
                                            )}
                                        </details>
                                      )}
                                </div>
                             )
                        })}
                        {isExecuting && <div className="flex items-center gap-2 mt-2"><Loader2 className="h-4 w-4 animate-spin text-primary inline-block" /><span className='text-sm text-muted-foreground'>Procesando turno...</span></div>}
                         {!isExecuting && executionError && <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm font-medium">Ejecución detenida debido a un error.</div>}
                         {!isExecuting && !executionError && currentTurn >= MAX_WORKGROUP_TURNS && executionLogs.length > 0 && <div className="mt-2 p-2 rounded bg-primary/10 text-primary text-sm font-medium">Ejecución completada (Límite de turnos alcanzado).</div>}
                         {!isExecuting && !executionError && currentTurn < MAX_WORKGROUP_TURNS && executionLogs.length > 1 && !isExecutingRef.current && <div className="mt-2 p-2 rounded bg-primary/10 text-primary text-sm font-medium">Ejecución finalizada o detenida.</div>}
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

