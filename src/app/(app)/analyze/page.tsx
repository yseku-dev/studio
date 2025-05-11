
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
import type { AgentConfig, WorkgroupConfig } from '@/types/agent'; 
import { resolveLlmOptionsForSource } from '@/lib/llm-utils';
import type { LLMOptions } from '@/services/groq';
import { LOCALSTORAGE_AGENTS_KEY, LOCALSTORAGE_WORKGROUPS_KEY } from '@/config/agent-config'; 

export default function AnalyzePage() {
  const { toast } = useToast();
  const router = useRouter();

  // These states are effectively unused now as CodeAnalysisSection manages its own LLM source selection
  // const [agents, setAgents] = useState<AgentConfig[]>([]);
  // const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  // const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global');
  // const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null);

  // useEffect(() => {
  //   const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
  //   if (storedAgents) {
  //     try { setAgents(JSON.parse(storedAgents)); } catch (e) { console.error("Error parsing stored agents:", e); setAgents([]); }
  //   }
  //   const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY); 
  //   if (storedWorkgroups) {
  //     try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); }
  //   }
  // }, []);

  // useEffect(() => {
  //   const options = resolveLlmOptionsForSource(selectedConfigSource, agents, workgroups); 
  //   setResolvedLlmOptions(options);
  // }, [selectedConfigSource, agents, workgroups]); 

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
  
  // const getSourceName = (sourceId: string): string => {
  //   if (sourceId === 'global') return 'Global';
  //   if (sourceId.startsWith('agent:')) {
  //     const agentId = sourceId.split(':')[1];
  //     return agents.find(a => a.id === agentId)?.name || `Agente ${agentId.substring(0,6)}...`;
  //   }
  //   if (sourceId.startsWith('workgroup:')) { 
  //     const workgroupId = sourceId.split(':')[1];
  //     return workgroups.find(wg => wg.id === workgroupId)?.name || `Grupo ${workgroupId.substring(0,6)}...`;
  //   }
  //   return 'Desconocido';
  // };

  return (
     <div className="space-y-6">
        {/* Selector is now part of CodeAnalysisSection */}
        <CodeAnalysisSection
            onSaveSnapshot={handleSaveSnapshot}
            // CodeAnalysisSection will fetch its own agents and workgroups for its selector
        />
    </div>
  );
}
