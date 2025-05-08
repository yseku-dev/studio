// src/components/workgroup-execution-modal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Play, Bot, Terminal, Clipboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WorkgroupConfig, AgentConfig } from '@/types/agent';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // Import Card components

interface WorkgroupExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  workgroup: WorkgroupConfig;
  agents: AgentConfig[]; // Pass available agents to find names and orchestrator
}

const ORCHESTRATOR_AGENT_NAME = "OrquestadorFlujoAgentes";

export function WorkgroupExecutionModal({ isOpen, onClose, workgroup, agents }: WorkgroupExecutionModalProps) {
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false); // To prevent re-running if already started
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const orchestrator = agents.find(a => a.id === workgroup.agentIds.find(id => agents.find(a => a.id === id)?.name === ORCHESTRATOR_AGENT_NAME));
  const participantAgents = agents.filter(a => workgroup.agentIds.includes(a.id) && a.id !== orchestrator?.id);

  const logMessage = (message: string, type: 'info' | 'agent' | 'error' | 'orchestrator' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    let prefix = `[${timestamp}] `;
    switch (type) {
        case 'info': prefix += 'ℹ️ INFO: '; break;
        case 'agent': prefix += '🤖 AGENT: '; break;
        case 'orchestrator': prefix += '👑 ORC: '; break;
        case 'error': prefix += '❌ ERROR: '; break;
    }
    setExecutionLogs(prev => [...prev, prefix + message]);
  };

  const getAgentNameById = (agentId: string): string => {
    return agents.find(a => a.id === agentId)?.name || 'Agente Desconocido';
  };

  // Simulate execution flow
  const simulateExecution = async () => {
    setIsExecuting(true);
    logMessage(`Iniciando ejecución del grupo de trabajo "${workgroup.name}"...`);
    await new Promise(res => setTimeout(res, 500));

    if (!orchestrator) {
      logMessage('¡Error crítico! No se encontró el agente Orquestador en la lista de agentes.', 'error');
      setIsExecuting(false);
      return;
    }

    logMessage(`Tarea principal asignada: "${workgroup.task}"`, 'info');
    await new Promise(res => setTimeout(res, 500));

    logMessage(`"${orchestrator.name}" recibe la tarea inicial.`, 'orchestrator');
    await new Promise(res => setTimeout(res, 1000));

    // Simulation Loop (e.g., 3 rounds)
    for (let round = 1; round <= 3; round++) {
      logMessage(`--- Ronda ${round} ---`, 'info');

      // Orchestrator chooses an agent (simple simulation: cycle through participants)
      const agentIndex = (round - 1) % participantAgents.length;
      const currentAgent = participantAgents[agentIndex];

      if (!currentAgent) {
        logMessage('No hay más agentes participantes para seleccionar.', 'orchestrator');
        break;
      }

      logMessage(`"${orchestrator.name}" pasa el control a "${currentAgent.name}".`, 'orchestrator');
      await new Promise(res => setTimeout(res, 1500));

      // Agent simulates processing
      logMessage(`"${currentAgent.name}" está procesando la tarea... (simulado)`, 'agent');
      await new Promise(res => setTimeout(res, 2500));
      const agentResponse = `Respuesta simulada de ${currentAgent.name} para la ronda ${round}. Propone realizar la acción X.`;
      logMessage(`"${currentAgent.name}": ${agentResponse}`, 'agent');
      await new Promise(res => setTimeout(res, 1000));

      // Orchestrator receives response
      logMessage(`"${orchestrator.name}" recibe la respuesta de "${currentAgent.name}". Analizando...`, 'orchestrator');
      await new Promise(res => setTimeout(res, 1500));
    }

    logMessage('Simulación de ejecución finalizada (3 rondas completadas).', 'info');
    setIsExecuting(false);
  };

  useEffect(() => {
    if (isOpen && !isExecuting) {
      setExecutionLogs([]); // Clear logs on open if not already running
      simulateExecution();
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
    navigator.clipboard.writeText(executionLogs.join('\n'))
      .then(() => toast({ title: 'Logs Copiados', description: 'Los logs de ejecución han sido copiados.' }))
      .catch(() => toast({ title: 'Error al Copiar', description: 'No se pudieron copiar los logs.', variant: 'destructive' }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Ejecución del Grupo: {workgroup.name}
          </DialogTitle>
          <DialogDescription>
            Observa el flujo de trabajo entre los agentes mientras colaboran en la tarea. (Simulado)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col gap-4">
           {/* Task Display */}
           <Card className='bg-muted/30 border-primary/20 flex-shrink-0'>
              <CardHeader className='p-3'>
                <CardTitle className='text-sm font-medium text-primary'>Tarea Principal</CardTitle>
              </CardHeader>
               <CardContent className='p-3 pt-0'>
                   <p className='text-xs text-foreground'>{workgroup.task}</p>
               </CardContent>
           </Card>

           {/* Log Area */}
           <div className="flex-1 border rounded-md p-1 flex flex-col bg-card min-h-0">
                <div className='flex justify-between items-center p-2 border-b mb-1'>
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
                             const isOrchestratorLog = log.includes('👑 ORC:');
                             const isAgentErrorLog = log.includes('❌ ERROR:');
                             const isAgentLog = log.includes('🤖 AGENT:') && !isAgentErrorLog;

                            return (
                                <span key={index} className={cn(
                                     isOrchestratorLog && "text-accent font-medium",
                                     isAgentLog && "text-foreground",
                                     isAgentErrorLog && "text-destructive",
                                     !isOrchestratorLog && !isAgentLog && !isAgentErrorLog && "text-muted-foreground"
                                )}>
                                    {log}\n
                                </span>
                             )
                        })}
                        {isExecuting && <Loader2 className="h-4 w-4 animate-spin text-primary inline-block" />}
                    </pre>
                </ScrollArea>
           </div>
        </div>

        <DialogFooter className="p-4 pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
