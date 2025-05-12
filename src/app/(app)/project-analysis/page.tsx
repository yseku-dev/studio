// src/app/(app)/project-analysis/page.tsx
'use client';

import { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderSearch, UploadCloud, Loader2, Settings2, ListOrdered, Trash2, Expand, Minimize, Bug, Link as LinkIcon, Github } from "lucide-react"; // Added LinkIcon, Github
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Added RadioGroup
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
// TODO: import { handleAnalyzeProjectViaWorkgroup, handleAnalyzeProjectViaGit } from './actions'; 
import { useDebug } from '@/contexts/DebugContext';
import { LLM_PROVIDERS, LOCALSTORAGE_PROVIDER_ID_KEY, getLocalStorageApiKeyName, getLocalStorageModelName, type LLMProviderId } from '@/config/llm-config';
import { cn } from '@/lib/utils';
import { fetchRepositoryContents } from '@/services/git-service'; // Import Git service


type AnalysisStatus = "idle" | "loading" | "success" | "error";
type ProjectSourceType = "file" | "git";

export default function ProjectAnalysisPage() {
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [gitRepoUrl, setGitRepoUrl] = useState<string>("");
  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("file");
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<string | null>(null); 
  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const { toast } = useToast();
  const { addDebugLog } = useDebug();
  const isMountedRef = useRef(false);

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global');
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    addDebugLog({ source: 'PROJECT_ANALYSIS_PAGE', type: 'INFO', message: 'Componente ProjectAnalysisPage montado.' });
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try { setAgents(JSON.parse(storedAgents)); } catch (e) { console.error("Error parsing stored agents:", e); setAgents([]); addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'ERROR', message: 'Error al parsear agentes.', data: e});}
    }
    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
      try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'ERROR', message: 'Error al parsear grupos.', data: e});}
    }
    return () => {
        isMountedRef.current = false;
        addDebugLog({ source: 'PROJECT_ANALYSIS_PAGE', type: 'INFO', message: 'Componente ProjectAnalysisPage desmontado.' });
    };
  }, [addDebugLog]);

  useEffect(() => {
    const options = resolveLlmOptionsForSource(selectedConfigSource, agents, workgroups, {
        [LOCALSTORAGE_PROVIDER_ID_KEY]: typeof window !== 'undefined' ? localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null : null,
        apiKeys: LLM_PROVIDERS.reduce((acc, p) => {
            acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageApiKeyName(p.id)) : null;
            return acc;
        }, {} as LocalStorageSnapshot['apiKeys']),
        modelNames: LLM_PROVIDERS.reduce((acc, p) => {
            acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageModelName(p.id)) : null;
            return acc;
        }, {} as LocalStorageSnapshot['modelNames']),
        apiUrls: LLM_PROVIDERS.reduce((acc, p) => {
            acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(`codealchemist_apiurl_${p.id}`) : null;
            return acc;
        }, {} as LocalStorageSnapshot['apiUrls']),
    });
    setResolvedLlmOptions(options);
    addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'DEBUG', message: `Opciones LLM resueltas para ${selectedConfigSource}`, data: options });
  }, [selectedConfigSource, agents, workgroups, addDebugLog]);

  const addServerLogsToDebugAndPage = useCallback((serverLogs: string[] | undefined, sourcePrefix: string = 'SERVER_PROJ_ANALYSIS') => {
    if (serverLogs) {
      setDetailedLogs(prev => [...prev, ...serverLogs]);
      if (isMountedRef.current) {
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
    }
  }, [addDebugLog]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'application/zip' || file.type === 'application/json' || file.name.endsWith('.zip') || file.name.endsWith('.json')) {
        setProjectFile(file);
        setGitRepoUrl(""); // Clear Git URL if file is uploaded
        addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'INFO', message: `Archivo seleccionado: ${file.name}`});
      } else {
        toast({ title: "Tipo de Archivo Inválido", description: "Selecciona .zip o .json.", variant: "destructive" });
        setProjectFile(null); event.target.value = '';
        addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'WARN', message: `Intento de carga de archivo inválido: ${file.name}`});
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
     setDetailedLogs([]);
     addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'INFO', message: `Iniciando análisis de proyecto. Config: ${getSourceName(selectedConfigSource)}`});
     if (selectedConfigSource.startsWith('workgroup:')) {
        const workgroupId = selectedConfigSource.split(':')[1];
        if (!workgroups.find(wg => wg.id === workgroupId)) {
            toast({ title: "Error de Configuración", description: `Grupo de trabajo '${getSourceName(selectedConfigSource)}' no encontrado.`, variant: "destructive", duration: 7000 });
            addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'ERROR', message: `Grupo de trabajo ${workgroupId} no encontrado.`});
            return;
        }
        // TODO: Implement workgroup analysis for project
        toast({ title: "Análisis con Grupo (Simulado)", description: `Iniciando análisis del proyecto con el grupo '${getSourceName(selectedConfigSource)}'. La funcionalidad real está pendiente.`, duration: 5000 });
        setAnalysisStatus("loading");
        await new Promise(resolve => setTimeout(resolve, 2000));
        setAnalysisResult(`Análisis simulado de proyecto con grupo '${getSourceName(selectedConfigSource)}'. Fuente: ${projectSourceType === 'git' ? gitRepoUrl : projectFile?.name}`);
        addServerLogsToDebugAndPage([`[${new Date().toISOString()}] [INFO] Análisis simulado completado para grupo.`]);
        setAnalysisStatus("success");
        return;
     }

     if (!resolvedLlmOptions) {
        toast({
            title: "Configuración LLM Incompleta",
            description: `Configuración para '${getSourceName(selectedConfigSource)}' incompleta.`,
            variant: "destructive", duration: 7000,
        });
        addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'ERROR', message: `Configuración LLM incompleta para ${selectedConfigSource}.`});
        return;
     }
    if (projectSourceType === "file" && !projectFile) { toast({ title: "Archivo Faltante", description: "Selecciona un archivo ZIP o JSON.", variant: "destructive" }); addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'WARN', message: `Intento de análisis de archivo sin archivo.`}); return; }
    if (projectSourceType === "git" && !gitRepoUrl.trim()) { toast({ title: "URL Faltante", description: "Introduce una URL de repositorio Git.", variant: "destructive" }); addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'WARN', message: `Intento de análisis Git sin URL.`}); return; }


    setAnalysisStatus("loading"); setAnalysisResult(null);
    let projectContentToAnalyze = "";
    let sourceDescription = "";

    if (projectSourceType === "git") {
      sourceDescription = `Git: ${gitRepoUrl}`;
      addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'INFO', message: `Obteniendo contenido desde Git: ${gitRepoUrl}`});
      const gitResult = await fetchRepositoryContents(gitRepoUrl);
      addServerLogsToDebugAndPage(gitResult.logsBuilt, 'SERVER_GIT_FETCH_PROJ_ANALYSIS');
      if (!gitResult.success || !gitResult.concatenatedSource) {
        toast({ title: "Error al Obtener de Git", description: gitResult.error || "No se pudo obtener el contenido del repositorio.", variant: "destructive" });
        setAnalysisStatus("error");
        addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'ERROR', message: `Fallo al obtener de Git: ${gitResult.error}`});
        return;
      }
      projectContentToAnalyze = gitResult.concatenatedSource;
    } else if (projectFile) {
      sourceDescription = `Archivo: ${projectFile.name}`;
      addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'INFO', message: `Leyendo contenido del archivo: ${projectFile.name}`});
      try {
        projectContentToAnalyze = await projectFile.text();
      } catch (e) {
        toast({ title: "Error de Lectura de Archivo", description: "No se pudo leer el contenido del archivo.", variant: "destructive"});
        setAnalysisStatus("error");
        addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'ERROR', message: `Fallo al leer archivo: ${(e as Error).message}`});
        return;
      }
    }
    
    addDebugLog({source: 'PROJECT_ANALYSIS_PAGE', type: 'DEBUG', message: `Simulando análisis con opciones LLM directas. Contenido (inicio): ${projectContentToAnalyze.substring(0,100)}...`, data: resolvedLlmOptions});
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setAnalysisResult(`Análisis simulado para ${sourceDescription} (usando ${resolvedLlmOptions.modelName})...\nContenido (primeros 200 caracteres):\n${projectContentToAnalyze.substring(0,200)}...`);
    addServerLogsToDebugAndPage([`[${new Date().toISOString()}] [INFO] Análisis simulado completado para ${sourceDescription}.`]);
    
    setAnalysisStatus("success");
    toast({ title: "Análisis Iniciado (Simulado)", description: `Análisis para ${sourceDescription} con '${getSourceName(selectedConfigSource)}'.` });
  };

  const isWorkgroupSelected = selectedConfigSource.startsWith('workgroup:');
  const canSubmit = analysisStatus === "loading" ||
                    (!resolvedLlmOptions && !isWorkgroupSelected) ||
                    (isWorkgroupSelected && workgroups.length === 0 && !workgroups.find(wg => wg.id === selectedConfigSource.split(':')[1])) ||
                    (projectSourceType === "file" && !projectFile) ||
                    (projectSourceType === "git" && !gitRepoUrl.trim());


  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2"><FolderSearch className="h-8 w-8" /> Analizar Proyecto Completo</CardTitle>
          <CardDescription>
            Sube un archivo ZIP/JSON o proporciona una URL de Git para un análisis holístico usando la configuración LLM seleccionada.
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
                        <ScrollArea className="h-[--radix-select-content-available-height] max-h-60">
                            <SelectItem value="global">Ajustes Globales</SelectItem>
                            {workgroups.map(wg => <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>Grupo: {wg.name}</SelectItem>)}
                            {agents.map(agent => <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>Agente: {agent.name}</SelectItem>)}
                        </ScrollArea>
                    </SelectContent>
                </Select>
                {(!resolvedLlmOptions && !isWorkgroupSelected && selectedConfigSource) && (
                     <p className="text-xs text-destructive mt-1">Configuración para '{getSourceName(selectedConfigSource)}' incompleta. Revisa Ajustes o Agentes.</p>
                )}
                {(isWorkgroupSelected && !workgroups.find(wg => wg.id === selectedConfigSource.split(':')[1])) && (
                    <p className="text-xs text-destructive mt-1">Grupo de trabajo '{getSourceName(selectedConfigSource)}' no encontrado o no disponible.</p>
                )}
            </div>

            <div className="space-y-2">
              <Label className="text-base">Fuente del Proyecto:</Label>
              <RadioGroup value={projectSourceType} onValueChange={(value) => setProjectSourceType(value as ProjectSourceType)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="file" id="source-file" />
                  <Label htmlFor="source-file" className="font-normal text-foreground">Subir Archivo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="git" id="source-git" />
                  <Label htmlFor="source-git" className="font-normal text-foreground">URL de Git</Label>
                </div>
              </RadioGroup>
            </div>

            {projectSourceType === "file" && (
              <div className="space-y-2">
                <Label htmlFor="project-file" className="text-base flex items-center gap-1"><UploadCloud className="h-5 w-5" /> Archivo del Proyecto (.zip o .json)</Label>
                <Input id="project-file" type="file" accept=".zip,.json,application/zip,application/json" onChange={handleFileChange} className="text-base file:text-base" />
                {projectFile && <p className="text-sm text-muted-foreground">Seleccionado: {projectFile.name}</p>}
              </div>
            )}

            {projectSourceType === "git" && (
              <div className="space-y-2">
                <Label htmlFor="git-repo-url" className="text-base flex items-center gap-1"><Github className="h-5 w-5" /> URL del Repositorio Git</Label>
                <Input id="git-repo-url" type="url" value={gitRepoUrl} onChange={(e) => { setGitRepoUrl(e.target.value); setProjectFile(null); }} placeholder="Ej: https://github.com/usuario/repositorio.git" className="text-base" />
                 <p className="text-xs text-muted-foreground">Introduce la URL HTTPS del repositorio Git público.</p>
              </div>
            )}

          <Button onClick={handleAnalyzeProject} disabled={canSubmit} className="w-full md:w-auto text-base py-3 px-6">
            {analysisStatus === "loading" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FolderSearch className="mr-2 h-5 w-5" />} Analizar Proyecto
          </Button>
          {analysisStatus !== "idle" && (
            <div className="mt-6 space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Resultados del Análisis</h3>
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
         <CardFooter><p className="text-xs text-muted-foreground">Análisis de proyectos grandes puede tardar. Resultados generados por IA. Funcionalidad en desarrollo (actualmente simulada para análisis profundo, usa Git/archivo).</p></CardFooter>
      </Card>
      {detailedLogs.length > 0 && (
          <Card className="mt-6 border-primary/30">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary"><ListOrdered className="h-5 w-5"/> Logs Detallados</CardTitle>
                  <div className="flex items-center gap-2">
                       <Button variant="ghost" size="icon" onClick={() => setLogsExpanded(!logsExpanded)} title={logsExpanded ? "Contraer Logs" : "Expandir Logs"}>
                          {logsExpanded ? <Minimize className="h-4 w-4"/> : <Expand className="h-4 w-4"/>}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDetailedLogs([])} title="Limpiar Logs">
                          <Trash2 className="h-4 w-4 text-destructive"/>
                      </Button>
                  </div>
              </CardHeader>
              <CardContent>
                  <ScrollArea className={cn("p-2 border rounded bg-muted/30 transition-all duration-300 ease-in-out", logsExpanded ? "h-[300px]" : "h-[100px]")}>
                      <pre className="text-xs text-foreground whitespace-pre-wrap">
                          {detailedLogs.map((log, index) => (
                              <span key={`log-${index}`} className={log.includes("[ERROR") || log.includes("Error:") ? "text-destructive" : log.includes("[WARN") ? "text-yellow-500 dark:text-yellow-400" : ""}>{log}\n</span>
                          ))}
                      </pre>
                  </ScrollArea>
              </CardContent>
          </Card>
      )}
    </div>
  );
}

