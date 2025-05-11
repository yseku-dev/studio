
'use client';
import { useState, useCallback, useEffect } from 'react'; // Added useEffect
import { CodeAnalysisSection } from '@/components/code-analysis-section';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent'; // Added WorkgroupConfig
import { resolveLlmOptionsForSource } from '@/lib/llm-utils';
import type { LLMOptions } from '@/services/groq';
import { LOCALSTORAGE_AGENTS_KEY, LOCALSTORAGE_WORKGROUPS_KEY } from '@/config/agent-config'; // Added WORKGROUPS_KEY

export default function AnalyzePage() {
  const { toast } = useToast();
  const router = useRouter();

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]); // Added workgroups state
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global');
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null);

  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try { setAgents(JSON.parse(storedAgents)); } catch (e) { console.error("Error parsing stored agents:", e); setAgents([]); }
    }
    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY); // Load workgroups
    if (storedWorkgroups) {
      try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); }
    }
  }, []);

  useEffect(() => {
    const options = resolveLlmOptionsForSource(selectedConfigSource, agents, workgroups); // Pass workgroups
    setResolvedLlmOptions(options);
  }, [selectedConfigSource, agents, workgroups]); // Add workgroups to dependency

  const handleSaveSnapshot = (code: string, nameSuffix: string) => {
    try {
      const snapshotsRaw = localStorage.getItem('codealchemist_snapshots');
      const snapshots = snapshotsRaw ? JSON.parse(snapshotsRaw) : [];
      const newSnapshot = {
        id: crypto.randomUUID(),
        name: `Análisis ${nameSuffix} - ${new Date().toLocaleString('es-ES')}`,
        code: code,
        timestamp: new Date().toISOString(),
      };
      snapshots.unshift(newSnapshot);
      localStorage.setItem('codealchemist_snapshots', JSON.stringify(snapshots));
      toast({
        title: '¡Versión Guardada!',
        description: `${newSnapshot.name} ha sido guardada.`,
        action: (<Button onClick={() => router.push('/versions')} variant="outline" size="sm">Ver Versiones</Button>),
      });
    } catch (error) {
      toast({ title: 'Error al Guardar', description: 'No se pudo guardar la versión.', variant: 'destructive' });
    }
  };
  
  const getSourceName = (sourceId: string): string => {
    if (sourceId === 'global') return 'Global';
    if (sourceId.startsWith('agent:')) {
      const agentId = sourceId.split(':')[1];
      return agents.find(a => a.id === agentId)?.name || `Agente ${agentId.substring(0,6)}...`;
    }
    if (sourceId.startsWith('workgroup:')) { // Handle workgroup source
      const workgroupId = sourceId.split(':')[1];
      return workgroups.find(wg => wg.id === workgroupId)?.name || `Grupo ${workgroupId.substring(0,6)}...`;
    }
    return 'Desconocido';
  };

  return (
     <div className="space-y-6">
        {/* This is now part of CodeAnalysisSection component itself */}
        {/* <div className="space-y-2 max-w-md">
            <Label htmlFor="configSourceAnalyze" className="text-base flex items-center gap-1"><Settings2 className="h-4 w-4"/> Usar Configuración LLM De:</Label>
            <Select onValueChange={setSelectedConfigSource} value={selectedConfigSource}>
                <SelectTrigger id="configSourceAnalyze"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="global">Ajustes Globales</SelectItem>
                    {agents.map(agent => <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>Agente: {agent.name}</SelectItem>)}
                    {workgroups.map(wg => <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>Grupo: {wg.name}</SelectItem>)}
                </SelectContent>
            </Select>
            {!resolvedLlmOptions && selectedConfigSource && (
                <p className="text-xs text-destructive mt-1">Configuración para '{getSourceName(selectedConfigSource)}' incompleta. Revisa Ajustes, Agentes o Grupos.</p>
            )}
        </div> */}
        <CodeAnalysisSection
            onSaveSnapshot={handleSaveSnapshot}
            // Pass agents and workgroups so CodeAnalysisSection can build its own selector
            // This avoids prop drilling llmOptions directly if the section handles its own LLM config source selection
            // Alternatively, CodeAnalysisSection could take resolvedLlmOptions if we keep the selector here.
            // For now, let CodeAnalysisSection manage its own LLM source selection to be self-contained.
        />
    </div>
  );
}
