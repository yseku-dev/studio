
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FolderPlus, Wand2, AlertTriangle, DownloadCloud, CheckCircle, FileText, ListTree, Copy, Settings2, ListOrdered, Trash2, Expand, Minimize } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { handleGenerateProject, initiateWorkgroupProjectGeneration } from './actions'; 
import type { HandleGenerateProjectResult, ProjectFile } from './actions';
import JSZip from 'jszip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


const formSchema = z.object({
  prompt: z.string().min(15, 'El prompt debe tener al menos 15 caracteres para describir un proyecto.'),
  configSource: z.string().min(1, 'Debes seleccionar una fuente de configuración LLM.'),
});

type FormData = z.infer<typeof formSchema>;

export default function GenerateProjectPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [generationResult, setGenerationResult] = useState<HandleGenerateProjectResult['data'] | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [promptToConfirm, setPromptToConfirm] = useState<string>("");
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null);

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);

  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const isMountedRef = useRef(false);

  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
      configSource: 'global',
    }
  });

  const currentPrompt = watch('prompt');
  const watchedConfigSource = watch('configSource');

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const addLog = useCallback((message: string, isClientLog: boolean = true) => {
    if (isMountedRef.current) {
      const prefix = isClientLog ? `[CLIENT ${new Date().toISOString()}]` : '';
      setDetailedLogs(prev => [...prev, `${prefix} ${message}`]);
    }
  }, []);

  const addServerLogs = useCallback((serverLogs: string[] | undefined) => {
    if (isMountedRef.current && serverLogs) {
        setDetailedLogs(prev => [...prev, ...serverLogs]);
    }
  }, []);

  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try { setAgents(JSON.parse(storedAgents)); } catch (e) { console.error("Error parsing stored agents:", e); setAgents([]); }
    }
    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
      try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); }
    }
    setValue('configSource', 'global');
  }, [setValue]);

  useEffect(() => {
    const options = resolveLlmOptionsForSource(watchedConfigSource, agents, workgroups);
    setResolvedLlmOptions(options);
  }, [watchedConfigSource, agents, workgroups]);


  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (!data.configSource.startsWith('workgroup:')) {
        const options = resolveLlmOptionsForSource(data.configSource, agents, workgroups);
        if (!options) {
            toast({
                title: "Configuración LLM Incompleta",
                description: `La configuración LLM seleccionada (${getSourceName(data.configSource)}) está incompleta.`,
                variant: "destructive", duration: 7000,
            });
            return;
        }
        setResolvedLlmOptions(options);
    } else {
        setResolvedLlmOptions(null);
    }
    setPromptToConfirm(data.prompt);
    setIsConfirming(true);
  };

  const proceedWithGeneration = async () => {
    setIsConfirming(false);
    if (!promptToConfirm) {
         toast({ title: "Error Interno", description: "Falta el prompt.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    setGenerationResult(null);
    setGenerationError(null);
    setDetailedLogs([]);
    addLog(`Iniciando generación de proyecto con prompt: "${promptToConfirm.substring(0, 50)}..."`);
    addLog(`Fuente de configuración LLM seleccionada: ${getSourceName(watchedConfigSource)}`);

    let result: HandleGenerateProjectResult;

    if (watchedConfigSource.startsWith('workgroup:')) {
      const workgroupId = watchedConfigSource.split(':')[1];
       if (!workgroups.find(wg => wg.id === workgroupId) || agents.length === 0) {
            addLog(`Error: Grupo de trabajo ${workgroupId} no encontrado o agentes no cargados.`);
            toast({ title: "Error de Configuración de Grupo", description: "Grupo de trabajo no encontrado o agentes no cargados.", variant: "destructive"});
            setIsLoading(false);
            return;
        }
      addLog(`Utilizando grupo de trabajo: ${getSourceName(watchedConfigSource)}`);

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
      addLog(`Snapshot de localStorage enviado al servidor para el grupo de trabajo.`);

      result = await initiateWorkgroupProjectGeneration(promptToConfirm, workgroupId, agents, workgroups, snapshot);
      addServerLogs(result.workgroupLogs);
    } else {
      if (!resolvedLlmOptions) {
        addLog(`Error: Faltan opciones LLM resueltas para llamada directa.`);
        toast({ title: "Error Interno", description: "Faltan opciones LLM para llamada directa.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      addLog(`Utilizando configuración LLM directa: ${resolvedLlmOptions.providerId} - ${resolvedLlmOptions.modelName}`);
      result = await handleGenerateProject(
          promptToConfirm,
          resolvedLlmOptions.providerId,
          resolvedLlmOptions.apiKey,
          resolvedLlmOptions.modelName,
          resolvedLlmOptions.apiUrl
      );
    }

    if (result.success && result.data) {
      setGenerationResult(result.data);
      addLog(`Generación de proyecto completada exitosamente.`);
      toast({ title: 'Generación de Proyecto Completa', description: 'Estructura generada.', action: <CheckCircle className="text-green-500" /> });
    } else {
      setGenerationError(result.error || 'Ocurrió un error desconocido.');
      addLog(`Error en la generación de proyecto: ${result.error || 'Desconocido'}`);
      toast({ title: 'Generación de Proyecto Fallida', description: result.error || `No se pudo generar estructura.`, variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleDownloadProject = async () => {
    if (!generationResult || !generationResult.projectStructure || generationResult.projectStructure.files.length === 0) {
      toast({ title: 'Nada que Descargar', description: 'No hay archivos para descargar.', variant: 'destructive' });
      return;
    }
    setIsDownloading(true);
    addLog(`Preparando descarga del proyecto: ${generationResult.projectStructure.projectName || 'proyecto_generado'}.zip`);
    toast({ title: 'Preparando Descarga', description: 'Creando ZIP del proyecto...' });

    try {
      const zip = new JSZip();
      generationResult.projectStructure.files.forEach((file: ProjectFile) => {
        zip.file(file.path, file.content);
      });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generationResult.projectStructure.projectName || 'proyecto_generado'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog(`Descarga del proyecto ${a.download} iniciada.`);
      toast({ title: "Descarga Iniciada", description: `El proyecto ${a.download} se está descargando.` });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Error desconocido";
      addLog(`Error al crear ZIP para descarga: ${error}`);
      toast({ title: "Error al Crear ZIP", description: `No se pudo crear ZIP: ${error}`, variant: "destructive" });
    }
    setIsDownloading(false);
  };

  const handleCopyError = (errorText: string | undefined) => {
    if (!errorText) return;
    navigator.clipboard.writeText(errorText)
      .then(() => toast({ title: 'Error Copiado', description: 'El error ha sido copiado.' }))
      .catch(err => toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar el error.', variant: 'destructive' }));
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
  
  const isWorkgroupSelected = watchedConfigSource.startsWith('workgroup:');
  const canSubmit = isLoading || !currentPrompt || (!resolvedLlmOptions && !isWorkgroupSelected) || (isWorkgroupSelected && workgroups.length === 0);

  const handleCopyLogsToClipboard = (logContent: string[] | string | undefined) => {
    if (!logContent) return;
    const textToCopy = Array.isArray(logContent) ? logContent.join('\n') : logContent;
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast({ title: 'Copiado', description: 'El contenido ha sido copiado al portapapeles.' }))
      .catch(err => {
        console.error('Error al copiar:', err);
        toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar el contenido.', variant: 'destructive' });
      });
  };
  const handleClearLogs = () => {
    setDetailedLogs(["[CLIENT INFO] Logs borrados por el usuario."]);
    toast({ title: "Logs Borrados", description: "Los logs de ejecución han sido borrados." });
  };
  const handleToggleLogsExpansion = () => setLogsExpanded(prev => !prev);


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <FolderPlus className="h-6 w-6 text-primary" /> Generar Proyecto
          </CardTitle>
          <CardDescription>
            Describe la estructura y tipo de proyecto, y la IA generará un borrador usando la configuración LLM seleccionada.
             {!resolvedLlmOptions && !isWorkgroupSelected && watchedConfigSource ? (
                 <span className="text-destructive block mt-1"> (Configuración para '{getSourceName(watchedConfigSource)}' incompleta)</span>
             ) : resolvedLlmOptions && !isWorkgroupSelected ? (
                <span className="text-foreground block mt-1">(Usando: {getSourceName(watchedConfigSource)} - {resolvedLlmOptions.providerId} - {resolvedLlmOptions.modelName})</span>
             ) : isWorkgroupSelected ? (
                <span className="text-foreground block mt-1">(Usando Grupo: {getSourceName(watchedConfigSource)})</span>
             ) : (
                 <span className="text-muted-foreground block mt-1">(Selecciona fuente de configuración)</span>
             )}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-base">Describe tu proyecto:</Label>
              <Textarea id="prompt" {...register('prompt')} rows={10} className="font-mono text-sm bg-card"
                placeholder="Ej: 'Un proyecto API REST con Express.js y TypeScript. Incluir ruta GET /health y POST /users. Configuración ESLint y Prettier.'" />
              {errors.prompt && <p className="text-sm text-destructive mt-1">{errors.prompt.message}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="configSource" className="text-base flex items-center gap-1"><Settings2 className="h-4 w-4"/> Usar Configuración LLM De:</Label>
                <Controller name="configSource" control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="configSource"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="global">Ajustes Globales</SelectItem>
                                {agents.map(agent => <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>Agente: {agent.name}</SelectItem>)}
                                {workgroups.map(wg => <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>Grupo: {wg.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )} />
                {errors.configSource && <p className="text-sm text-destructive mt-1">{errors.configSource.message}</p>}
                 {!resolvedLlmOptions && !isWorkgroupSelected && watchedConfigSource && (
                     <p className="text-xs text-destructive mt-1">Configuración para '{getSourceName(watchedConfigSource)}' incompleta. Revisa Ajustes o Agentes.</p>
                )}
            </div>
          </CardContent>
          <CardFooter>
            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
              <AlertDialogTrigger asChild>
                <Button type="submit" disabled={canSubmit} className="w-full md:w-auto">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Generar Proyecto
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Generación de Proyecto</AlertDialogTitle>
                   <AlertDialogDescription>
                    <p>Generar estructura con '{getSourceName(watchedConfigSource)}'?</p>
                    {!isWorkgroupSelected && resolvedLlmOptions && (
                        <div className="mt-1 text-xs text-muted-foreground">(Proveedor: {resolvedLlmOptions?.providerId}, Modelo: {resolvedLlmOptions?.modelName})</div>
                    )}
                    {isWorkgroupSelected && (
                        <div className="mt-1 text-xs text-muted-foreground">(Grupo de Trabajo)</div>
                    )}
                    <ScrollArea className="h-[150px] mt-2 p-2 border rounded bg-muted/30">
                        <pre className="text-xs text-foreground whitespace-pre-wrap">{promptToConfirm}</pre>
                    </ScrollArea>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setPromptToConfirm("")}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={proceedWithGeneration}>Sí, Generar Proyecto</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </form>
      </Card>

      {isLoading && (
        <div data-ai-hint="project structure generation" className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-foreground">Generando estructura de proyecto...</p>
          <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos.</p>
        </div>
      )}

      {generationError && !isLoading && (
        <Card className="shadow-lg border-destructive bg-destructive/10 mt-6">
          <CardHeader><CardTitle className="text-xl flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" /> Error en Generación</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-destructive">No se pudo generar la estructura:</p>
             <ScrollArea className="h-[100px] p-2 border border-destructive/30 rounded bg-background/50"><pre className="text-xs text-foreground whitespace-pre-wrap">{generationError}</pre></ScrollArea>
            <Button variant="outline" size="sm" onClick={() => handleCopyError(generationError)} className="mt-2 text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground">
                <Copy className="mr-2 h-4 w-4"/> Copiar Error
            </Button>
          </CardContent>
        </Card>
      )}

      {generationResult && !isLoading && !generationError && (
        <Card className="shadow-lg mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="text-2xl">Proyecto: {generationResult.projectStructure.projectName || "Sin Nombre"}</CardTitle>
                <Button onClick={handleDownloadProject} disabled={isDownloading || !generationResult.projectStructure.files?.length} variant="outline">
                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />} Descargar (ZIP)
                </Button>
            </div>
            <CardDescription>Generado usando '{getSourceName(watchedConfigSource)}'.</CardDescription>
            {generationResult.notes && (
                 <div className="pt-2 text-sm text-foreground flex items-start gap-2">
                    <Badge variant="secondary" className="shrink-0 mt-0.5">Notas IA:</Badge> <span className='text-muted-foreground'>{generationResult.notes}</span>
                 </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
             {generationResult.projectStructure.files?.length > 0 ? (
                <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><ListTree className="h-5 w-5 text-accent"/>Archivos Generados:</h3>
                    <ScrollArea className="h-[500px] rounded-md border bg-card p-3">
                        <ul className="space-y-2">
                            {generationResult.projectStructure.files.map((file: ProjectFile, index: number) => (
                                <li key={index} className="text-sm font-mono text-foreground">
                                    <details>
                                        <summary className="cursor-pointer hover:text-primary p-1 rounded hover:bg-muted/50 flex items-center gap-1">
                                            <FileText className="inline-block mr-1 h-4 w-4 text-muted-foreground shrink-0"/>
                                            <span className='truncate'>{file.path}</span>
                                        </summary>
                                        <ScrollArea className="max-h-[300px] mt-1 ml-4 border-l-2 border-primary/30 pl-3">
                                          <pre className="p-2 text-xs whitespace-pre-wrap break-all bg-muted/30 rounded-r-md">{file.content || "// Archivo vacío"}</pre>
                                        </ScrollArea>
                                    </details>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                </div>
             ) : (
                <p className="text-muted-foreground">La IA no generó archivos para este proyecto.</p>
             )}
          </CardContent>
        </Card>
      )}

      {detailedLogs.length > 0 && (
        <Card className="mt-6 border-primary/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-primary"><ListOrdered className="h-5 w-5" /> Logs de Generación</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleToggleLogsExpansion} title={logsExpanded ? "Contraer Logs" : "Expandir Logs"}>
                  {logsExpanded ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleClearLogs} title="Borrar Logs"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleCopyLogsToClipboard(detailedLogs)} title="Copiar Logs"><Copy className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className={cn("p-2 border rounded bg-muted/30 transition-all duration-300 ease-in-out", logsExpanded ? "h-[300px]" : "h-[150px]")}>
              <pre className="text-xs text-foreground whitespace-pre-wrap">
                {detailedLogs.map((log, index) => (
                  <span key={`detail-${index}`} className={log.includes("[ERROR") || log.includes("Error:") || log.includes("Falló") ? "text-destructive" : log.includes("[WARN") ? "text-yellow-600 dark:text-yellow-400" : log.includes("[CLIENT") ? "text-muted-foreground" : ""}>{log}\n</span>
                ))}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

