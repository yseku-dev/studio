
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderSearch, UploadCloud, GitFork, Loader2, Settings2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { resolveLlmOptionsForSource } from '@/lib/llm-utils';
import type { LLMOptions } from '@/services/groq';
import { LOCALSTORAGE_AGENTS_KEY, LOCALSTORAGE_WORKGROUPS_KEY } from '@/config/agent-config';
// TODO: import { handleAnalyzeProjectViaWorkgroup } from './actions';

type AnalysisStatus = "idle" | "loading" | "success" | "error";

export default function ProjectAnalysisPage() {
  const [activeTab, setActiveTab] = useState<"upload" | "git">("upload");
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState<string>("");
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<string | null>(null); // Keep as string for simulated result
  const { toast } = useToast();

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global');
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null);

  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try { setAgents(JSON.parse(storedAgents)); } catch (e) { console.error("Error parsing stored agents:", e); setAgents([]); }
    }
    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
      try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); }
    }
  }, []);

  useEffect(() => {
    const options = resolveLlmOptionsForSource(selectedConfigSource, agents, workgroups);
    setResolvedLlmOptions(options);
  }, [selectedConfigSource, agents, workgroups]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'application/zip' || file.type === 'application/json' || file.name.endsWith('.zip') || file.name.endsWith('.json')) {
        setProjectFile(file);
      } else {
        toast({ title: "Tipo de Archivo Inválido", description: "Selecciona .zip o .json.", variant: "destructive" });
        setProjectFile(null); event.target.value = '';
      }
    } else { setProjectFile(null); }
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

  const handleAnalyzeProject = async () => {
     if (selectedConfigSource.startsWith('workgroup:')) {
        // Workgroup logic
        toast({ title: "Análisis con Grupo (Simulado)", description: `Iniciando análisis del proyecto con el grupo '${getSourceName(selectedConfigSource)}'. La funcionalidad real está pendiente.`, duration: 5000 });
        setAnalysisStatus("loading");
        await new Promise(resolve => setTimeout(resolve, 2000));
        setAnalysisResult(`Análisis simulado de proyecto con grupo '${getSourceName(selectedConfigSource)}'.`);
        setAnalysisStatus("success");
        return;
     }
     
     // Direct LLM call logic
     if (!resolvedLlmOptions) {
        toast({
            title: "Configuración LLM Incompleta",
            description: `Configuración para '${getSourceName(selectedConfigSource)}' incompleta.`,
            variant: "destructive", duration: 7000,
        }); return;
     }
    if (activeTab === "upload" && !projectFile) { toast({ title: "Archivo Faltante", description: "Selecciona ZIP/JSON.", variant: "destructive" }); return; }
    if (activeTab === "git" && !gitUrl) { toast({ title: "URL Faltante", description: "Ingresa URL Git.", variant: "destructive" }); return; }

    setAnalysisStatus("loading"); setAnalysisResult(null);
    console.log("Simulating analysis with options:", resolvedLlmOptions); // Keep for direct call context
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (activeTab === "upload" && projectFile) {
      setAnalysisResult(`Análisis simulado para ${projectFile.name} (usando ${resolvedLlmOptions.modelName})...`);
    } else if (activeTab === "git") {
      setAnalysisResult(`Análisis simulado para ${gitUrl} (usando ${resolvedLlmOptions.modelName})...`);
    }
    setAnalysisStatus("success");
    toast({ title: "Análisis Iniciado (Simulado)", description: `Análisis para ${activeTab === "upload" ? projectFile?.name : gitUrl} con '${getSourceName(selectedConfigSource)}'.` });
  };
  
  const isWorkgroupSelected = selectedConfigSource.startsWith('workgroup:');
  const canSubmit = analysisStatus === "loading" || (!resolvedLlmOptions && !isWorkgroupSelected) || (isWorkgroupSelected && workgroups.length === 0) || (activeTab === "upload" && !projectFile) || (activeTab === "git" && !gitUrl);


  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2"><FolderSearch className="h-8 w-8" /> Analizar Proyecto Completo</CardTitle>
          <CardDescription>
            Sube ZIP/JSON o URL Git para análisis usando config LLM seleccionada.
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
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="configSourceProject" className="text-base flex items-center gap-1"><Settings2 className="h-4 w-4"/> Usar Configuración LLM De:</Label>
                <Select onValueChange={setSelectedConfigSource} value={selectedConfigSource}>
                    <SelectTrigger id="configSourceProject" className="w-full md:w-1/2"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="global">Ajustes Globales</SelectItem>
                        {agents.map(agent => <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>Agente: {agent.name}</SelectItem>)}
                        {workgroups.map(wg => <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>Grupo: {wg.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                {!resolvedLlmOptions && !isWorkgroupSelected && selectedConfigSource && (
                     <p className="text-xs text-destructive mt-1">Configuración para '{getSourceName(selectedConfigSource)}' incompleta. Revisa Ajustes o Agentes.</p>
                )}
            </div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "upload" | "git")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="gap-2"><UploadCloud className="h-5 w-5" /> Subir Archivo (ZIP/JSON)</TabsTrigger>
              <TabsTrigger value="git" className="gap-2"><GitFork className="h-5 w-5" /> Desde Repositorio Git</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-6">
              <div className="space-y-2">
                <Label htmlFor="project-file" className="text-base">Archivo del Proyecto (.zip o .json)</Label>
                <Input id="project-file" type="file" accept=".zip,.json,application/zip,application/json" onChange={handleFileChange} className="text-base file:text-base" />
                {projectFile && <p className="text-sm text-muted-foreground">Seleccionado: {projectFile.name}</p>}
              </div>
            </TabsContent>
            <TabsContent value="git" className="mt-6">
              <div className="space-y-2">
                <Label htmlFor="git-url" className="text-base">URL del Repositorio Git</Label>
                <Input id="git-url" type="url" placeholder="https://github.com/usuario/repo.git" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} className="text-base" />
              </div>
            </TabsContent>
          </Tabs>
          <Button onClick={handleAnalyzeProject} disabled={canSubmit} className="w-full md:w-auto text-base py-3 px-6">
            {analysisStatus === "loading" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FolderSearch className="mr-2 h-5 w-5" />} Analizar Proyecto
          </Button>
          {analysisStatus !== "idle" && (
            <div className="mt-6 space-y-4">
              <h3 className="text-xl font-semibold">Resultados del Análisis</h3>
              {analysisStatus === "loading" && (
                <div data-ai-hint="project analysis loading" className="flex items-center justify-center p-8 bg-muted/50 rounded-lg min-h-[150px]">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-4 text-lg text-foreground">Analizando...</p>
                </div>
              )}
              {analysisStatus === "success" && analysisResult && (
                <Card className="bg-card"><CardContent className="p-6"><pre className="whitespace-pre-wrap text-sm font-mono text-foreground">{analysisResult}</pre></CardContent></Card>
              )}
              {analysisStatus === "error" && (
                 <Card className="bg-destructive/10 border-destructive"><CardContent className="p-6"><p className="text-destructive">Error durante análisis.</p></CardContent></Card>
              )}
            </div>
          )}
        </CardContent>
         <CardFooter><p className="text-xs text-muted-foreground">Análisis de proyectos grandes puede tardar. Resultados generados por IA. Funcionalidad en desarrollo (actualmente simulada).</p></CardFooter>
      </Card>
    </div>
  );
}
