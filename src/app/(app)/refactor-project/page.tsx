// src/app/(app)/refactor-project/page.tsx
'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { GitPullRequestDraft, UploadCloud, GitFork, Loader2, Wand2, Settings2, AlertTriangle, Copy, Trash2, ListOrdered, Eye, CheckCircle, XCircle } from "lucide-react";
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import type { LLMOptions } from '@/services/groq';
import { LOCALSTORAGE_AGENTS_KEY, LOCALSTORAGE_WORKGROUPS_KEY, ORCHESTRATOR_AGENT_NAME } from '@/config/agent-config';
import { LLM_PROVIDERS, LOCALSTORAGE_PROVIDER_ID_KEY, getLocalStorageApiKeyName, getLocalStorageModelName, type LLMProviderId } from '@/config/llm-config';
import { handleGetRefactoringSuggestions, handleApplyRefactoringSuggestion, type HandleGetRefactoringSuggestionsPayload } from './actions';

const refactorParamsSchema = z.object({
  goals: z.string().optional(),
  priority: z.enum(["seguridad", "legibilidad", "rendimiento", "estandarizar", "reducir_complejidad"]).optional(),
});

type RefactorParamsFormData = z.infer<typeof refactorParamsSchema>;

const fileOrUrlSchema = z.object({
  configSource: z.string().min(1, 'Debes seleccionar una fuente de configuración LLM.'),
  projectFile: z.instanceof(File).optional(),
  gitUrl: z.string().url({ message: "URL de Git inválida." }).optional(),
}).refine(data => data.projectFile || data.gitUrl, {
  message: "Debes subir un archivo o proporcionar una URL de Git.",
  path: ["projectFile"], 
});

type FileOrUrlFormData = z.infer<typeof fileOrUrlSchema>;

interface RefactoringSuggestion {
  id: string;
  area: string;
  description: string;
  priority: 'Alta' | 'Media' | 'Baja';
  suggestedSnippet?: string;
  originalContent?: string; 
  status?: 'pending' | 'applied' | 'dismissed' | 'error';
  errorMessage?: string;
}

export default function RefactorProjectPage() {
  const [activeTab, setActiveTab] = useState<"upload" | "git">("upload");
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'analyzing' | 'success' | 'error'>("idle");
  const [suggestions, setSuggestions] = useState<RefactoringSuggestion[]>([]);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null);

  const { toast } = useToast();

  const fileForm = useForm<FileOrUrlFormData>({
    resolver: zodResolver(fileOrUrlSchema),
    defaultValues: { configSource: 'global' },
  });

  const paramsForm = useForm<RefactorParamsFormData>({
    resolver: zodResolver(refactorParamsSchema),
  });

  const watchedConfigSource = fileForm.watch('configSource');

  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) try { setAgents(JSON.parse(storedAgents)); } catch (e) { console.error("Error parsing agents", e); }
    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing workgroups", e); }
    fileForm.setValue('configSource', 'global');
  }, [fileForm]);

  useEffect(() => {
    const options = resolveLlmOptionsForSource(watchedConfigSource, agents, workgroups);
    setResolvedLlmOptions(options);
  }, [watchedConfigSource, agents, workgroups]);
  
  const addLog = useCallback((message: string) => {
    setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      // Allow more general text files in addition to zip/json for content reading
      if (file.type === 'application/zip' || file.name.endsWith('.zip') || 
          file.type === 'application/json' || file.name.endsWith('.json') ||
          file.type.startsWith('text/')) {
        fileForm.setValue('projectFile', file);
        fileForm.clearErrors('projectFile');
        toast({ title: "Archivo Seleccionado", description: file.name });
      } else {
        toast({ title: "Tipo de Archivo Inválido", description: "Por favor, selecciona un archivo .zip, .json o de texto.", variant: "destructive" });
        fileForm.setValue('projectFile', undefined);
        event.target.value = '';
      }
    }
  };

  const handleAnalyzeRefactor: SubmitHandler<FileOrUrlFormData> = async (data) => {
    const params = paramsForm.getValues();
    setAnalysisStatus("loading");
    setCurrentError(null);
    setSuggestions([]);
    addLog("Iniciando análisis de refactorización...");

    const file = data.projectFile;
    let projectFileContent: string | undefined;
    let projectFileName: string | undefined;
    let projectFileType: string | undefined;

    if (file) {
      projectFileName = file.name;
      projectFileType = file.type;
      try {
        // For ZIP, we'd ideally send the binary data or process on client to extract text.
        // For now, if it's not JSON or text, we can't read its content as a simple string here.
        if (file.type === 'application/json' || file.type.startsWith('text/')) {
            projectFileContent = await file.text();
        } else if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
            // We can't read ZIP content as simple text on client for now.
            // The server action will handle the "simulated" placeholder.
            // If actual ZIP processing were client-side, it'd be more complex.
            addLog(`Archivo ZIP (${file.name}) seleccionado. El contenido textual no se leerá en el cliente para este tipo.`);
        } else {
            toast({ title: "Error de Archivo", description: `No se puede procesar el contenido de '${file.name}' como texto.`, variant: "destructive" });
            setAnalysisStatus("idle");
            return;
        }
      } catch (e) {
        toast({ title: "Error de Lectura", description: "No se pudo leer el contenido del archivo.", variant: "destructive" });
        setAnalysisStatus("idle");
        return;
      }
    }
    
    let snapshot: LocalStorageSnapshot | undefined = undefined;
    if (data.configSource.startsWith('workgroup:')) {
      snapshot = {
        [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
        apiKeys: {},
        modelNames: {},
        apiUrls: {},
      };
      LLM_PROVIDERS.forEach(provider => {
        snapshot!.apiKeys[provider.id] = localStorage.getItem(getLocalStorageApiKeyName(provider.id));
        snapshot!.modelNames[provider.id] = localStorage.getItem(getLocalStorageModelName(provider.id));
        snapshot!.apiUrls[provider.id] = localStorage.getItem(`codealchemist_apiurl_${provider.id}`);
      });
    }

    const actionPayload: HandleGetRefactoringSuggestionsPayload = {
      projectFileContent,
      projectFileName,
      projectFileType,
      gitUrl: data.gitUrl,
      goals: params.goals,
      priority: params.priority,
      configSource: data.configSource,
      llmOptions: data.configSource.startsWith('workgroup:') ? undefined : resolvedLlmOptions || undefined,
      agents: data.configSource.startsWith('workgroup:') ? agents : undefined,
      workgroups: data.configSource.startsWith('workgroup:') ? workgroups : undefined,
      localStorageSnapshot: snapshot,
    };
    
    setAnalysisStatus("analyzing");
    const result = await handleGetRefactoringSuggestions(actionPayload);
    (result.workgroupLogs || []).forEach(logMsg => addLog(`[SERVER] ${logMsg}`));


    if (result.success && result.data) {
      setSuggestions(result.data.map(s => ({...s, id: crypto.randomUUID(), status: 'pending'})));
      setAnalysisStatus("success");
      toast({ title: "Análisis Completado", description: "Sugerencias de refactorización generadas." });
    } else {
      setCurrentError(result.error || "Error desconocido durante el análisis.");
      setAnalysisStatus("error");
      toast({ title: "Error de Análisis", description: result.error, variant: "destructive" });
    }
    setAnalysisStatus(isProcessing ? "analyzing" : result.success ? "success" : "error");
  };

  const handleApplySuggestion = async (suggestionId: string) => {
    addLog(`Intentando aplicar sugerencia: ${suggestionId}`);
    // TODO: Implement server action call
    // For now, we need a projectIdentifier. This could be the projectFileName if dealing with single file content.
    // If it's a ZIP or Git repo, this becomes more complex and would need server-side state.
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    toast({title: "Aplicando Sugerencia (Simulado)", description: `Aplicando cambios para ${suggestion.area}. La funcionalidad real está pendiente.`});
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? {...s, status: 'applied'} : s));
    // const result = await handleApplyRefactoringSuggestion({suggestionId, projectIdentifier: "current_project_context_placeholder"});
    // Update suggestion status based on result
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? {...s, status: 'dismissed'} : s));
    toast({title: "Sugerencia Descartada", description: `Sugerencia ${suggestionId} descartada.`});
  };
  
  const handleApplyAllSuggestions = async () => {
    addLog("Intentando aplicar todas las sugerencias...");
    toast({ title: "Aplicando Todas (Simulado)", description: "Se están aplicando todas las sugerencias. La funcionalidad real está pendiente." });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    setSuggestions(prev => prev.map(s => s.status === 'pending' ? {...s, status: 'applied'} : s));
    toast({ title: "Todas las Sugerencias Aplicadas (Simulado)" });
  };


  const getSourceName = (sourceId: string): string => {
    if (sourceId === 'global') return 'Agente Refactorizador (Config. Global)';
    const agentPrefix = "agent:";
    const workgroupPrefix = "workgroup:";

    if (sourceId.startsWith(agentPrefix)) {
      const agentId = sourceId.substring(agentPrefix.length);
      const agent = agents.find(a => a.id === agentId);
      return agent ? `Agente: ${agent.name}` : `Agente ${agentId.substring(0, 6)}...`;
    }
    if (sourceId.startsWith(workgroupPrefix)) {
      const workgroupId = sourceId.substring(workgroupPrefix.length);
      const workgroup = workgroups.find(wg => wg.id === workgroupId);
      return workgroup ? `Grupo: ${workgroup.name}` : `Grupo ${workgroupId.substring(0, 6)}...`;
    }
    return 'Desconocido';
  };
  
  const isProcessing = analysisStatus === "loading" || analysisStatus === "analyzing";
  const formValues = fileForm.watch();
  const canSubmit = isProcessing || 
                    (!formValues.projectFile && !formValues.gitUrl) || 
                    (!resolvedLlmOptions && !watchedConfigSource.startsWith("workgroup:"));


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <GitPullRequestDraft className="h-8 w-8" /> Refactorizar Proyecto
          </CardTitle>
          <CardDescription>
            Sube o vincula tu proyecto y obtén sugerencias de refactorización potenciadas por IA.
             {!resolvedLlmOptions && watchedConfigSource && !watchedConfigSource.startsWith("workgroup:") ? (
                <span className="text-destructive block mt-1"> (Configuración para '{getSourceName(watchedConfigSource)}' incompleta)</span>
             ) : resolvedLlmOptions || watchedConfigSource.startsWith("workgroup:") ? (
                <span className="text-foreground block mt-1">(Usando: {getSourceName(watchedConfigSource)})</span>
             ) : (
                 <span className="text-muted-foreground block mt-1">(Selecciona fuente de configuración)</span>
             )}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={fileForm.handleSubmit(handleAnalyzeRefactor)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="configSourceRefactor" className="text-base flex items-center gap-1"><Settings2 className="h-4 w-4"/> Usar Configuración LLM De:</Label>
              <Controller
                name="configSource"
                control={fileForm.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="configSourceRefactor" className="w-full md:w-1/2">
                      <SelectValue placeholder="Seleccionar fuente (Agente Refactorizador o Grupo)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Agente Refactorizador (Config. Global)</SelectItem>
                      {agents.filter(a => a.name.toLowerCase().includes("refactor") || a.name === ORCHESTRATOR_AGENT_NAME || a.name === "RefactorizadorCodigoExperto").map(agent => (
                        <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>Agente: {agent.name}</SelectItem>
                      ))}
                       {workgroups.filter(wg => wg.agentIds.some(agentId => agents.find(a => a.id === agentId)?.name.toLowerCase().includes("refactor") || agents.find(a => a.id === agentId)?.name === "RefactorizadorCodigoExperto")).map(wg => (
                        <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>Grupo: {wg.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {fileForm.formState.errors.configSource && <p className="text-sm text-destructive mt-1">{fileForm.formState.errors.configSource.message}</p>}
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "upload" | "git")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="gap-2"><UploadCloud className="h-5 w-5" /> Subir Archivo (ZIP/JSON/Texto)</TabsTrigger>
                <TabsTrigger value="git" className="gap-2"><GitFork className="h-5 w-5" /> Desde Repositorio Git</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-6">
                <div className="space-y-2">
                  <Label htmlFor="project-file" className="text-base">Archivo del Proyecto (.zip, .json, .txt, .py, etc.)</Label>
                  <Input id="project-file" type="file" accept=".zip,.json,application/zip,application/json,text/*,.py,.js,.ts,.java" onChange={handleFileChange} className="text-base file:text-base" />
                  {fileForm.watch('projectFile') && <p className="text-sm text-muted-foreground">Seleccionado: {fileForm.watch('projectFile.name')}</p>}
                  {fileForm.formState.errors.projectFile && <p className="text-sm text-destructive mt-1">{fileForm.formState.errors.projectFile.message as string}</p>}
                </div>
              </TabsContent>
              <TabsContent value="git" className="mt-6">
                <div className="space-y-2">
                  <Label htmlFor="git-url" className="text-base">URL del Repositorio Git</Label>
                  <Input id="git-url" type="url" placeholder="https://github.com/usuario/repo.git" {...fileForm.register('gitUrl')} className="text-base" />
                  {fileForm.formState.errors.gitUrl && <p className="text-sm text-destructive mt-1">{fileForm.formState.errors.gitUrl.message}</p>}
                   <p className="text-xs text-muted-foreground">Funcionalidad de Git aún en desarrollo. Actualmente simulada para la extracción de contenido.</p>
                </div>
              </TabsContent>
            </Tabs>

            <Card className="bg-muted/30 p-4">
              <CardTitle className="text-md mb-2">Parámetros de Refactorización</CardTitle>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="goals">Metas (separadas por coma)</Label>
                  <Input id="goals" {...paramsForm.register('goals')} placeholder="Ej: Mejorar rendimiento, Estandarizar código" />
                </div>
                <div>
                  <Label htmlFor="priority">Prioridad General</Label>
                  <Controller
                    name="priority"
                    control={paramsForm.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="priority"><SelectValue placeholder="Seleccionar prioridad" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="seguridad">Priorizar Seguridad</SelectItem>
                          <SelectItem value="legibilidad">Priorizar Legibilidad</SelectItem>
                          <SelectItem value="rendimiento">Priorizar Rendimiento</SelectItem>
                          <SelectItem value="estandarizar">Estandarizar Código</SelectItem>
                          <SelectItem value="reducir_complejidad">Reducir Complejidad</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </Card>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-4">
            <Button type="submit" disabled={canSubmit} className="w-full md:w-auto text-base py-3 px-6">
              {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />} Analizar para Refactorizar
            </Button>
            {analysisStatus === 'success' && suggestions.length > 0 && (
              <Button onClick={handleApplyAllSuggestions} variant="secondary" className="w-full md:w-auto text-base">
                Aplicar Todas las Sugerencias ({suggestions.filter(s=>s.status === 'pending').length}) (Simulado)
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>

      {isProcessing && (
        <div data-ai-hint="project refactoring loading" className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-foreground">Analizando proyecto para refactorización...</p>
        </div>
      )}

      {currentError && analysisStatus === "error" && (
        <Card className="shadow-lg border-destructive bg-destructive/10 mt-6">
          <CardHeader><CardTitle className="text-xl flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" /> Error de Análisis</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-destructive">No se pudo completar el análisis:</p>
            <ScrollArea className="h-[80px] p-2 border border-destructive/30 rounded bg-background/50"><pre className="text-xs text-foreground whitespace-pre-wrap">{currentError}</pre></ScrollArea>
             <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(currentError)} className="mt-2 text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground">
                <Copy className="mr-2 h-4 w-4"/> Copiar Error
            </Button>
          </CardContent>
        </Card>
      )}

      {analysisStatus === "success" && suggestions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Sugerencias de Refactorización ({suggestions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-3">
              <ul className="space-y-4">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <Card className="bg-card/50">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-md">{s.area}</CardTitle>
                          <Badge variant={s.priority === 'Alta' ? 'destructive' : s.priority === 'Media' ? 'default' : 'outline'} className="capitalize text-xs shrink-0">{s.priority}</Badge>
                        </div>
                        <CardDescription className="text-sm">{s.description}</CardDescription>
                      </CardHeader>
                      {s.suggestedSnippet && (
                        <CardContent className="py-2">
                          <Label className="text-xs">Cambio Sugerido:</Label>
                          <ScrollArea className="max-h-32 mt-1 rounded bg-muted p-2 border"><pre className="text-xs font-mono whitespace-pre-wrap">{s.suggestedSnippet}</pre></ScrollArea>
                        </CardContent>
                      )}
                      <CardFooter className="pt-3 gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => handleApplySuggestion(s.id)} disabled={s.status === 'applied' || s.status === 'dismissed'} className="text-xs">
                          {s.status === 'applied' ? <CheckCircle className="mr-1 h-4 w-4"/> : <Wand2 className="mr-1 h-4 w-4" />}
                          {s.status === 'applied' ? 'Aplicada (Simulado)' : 'Aplicar (Simulado)'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toast({title: "Vista de Diff (Simulada)", description: `Mostrando diferencias para ${s.area}. Funcionalidad de Diff real está pendiente.`})} className="text-xs">
                          <Eye className="mr-1 h-4 w-4"/> Ver Diff
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDismissSuggestion(s.id)} disabled={s.status === 'applied' || s.status === 'dismissed'} className="text-xs text-muted-foreground hover:text-destructive">
                          <Trash2 className="mr-1 h-4 w-4"/> Descartar
                        </Button>
                         {s.status === 'error' && <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="h-3 w-3"/>Error al aplicar: {s.errorMessage}</p>}
                      </CardFooter>
                    </Card>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {detailedLogs.length > 0 && (
        <Card className="mt-6 border-primary/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-primary"><ListOrdered className="h-5 w-5" /> Logs de Ejecución</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setLogsExpanded(!logsExpanded)} title={logsExpanded ? "Contraer" : "Expandir"}><ListOrdered className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setDetailedLogs([])} title="Limpiar Logs"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(detailedLogs.join("\n"))} title="Copiar Logs"><Copy className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className={cn("p-2 border rounded bg-muted/30 transition-all duration-300 ease-in-out", logsExpanded ? "h-[300px]" : "h-[100px]")}>
              <pre className="text-xs text-foreground whitespace-pre-wrap">
                {detailedLogs.map((log, index) => (
                  <span key={`log-${index}`} className={log.includes("[ERROR") || log.includes("Error:") ? "text-destructive" : log.includes("[WARN") ? "text-yellow-500" : ""}>{log}\n</span>
                ))}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
