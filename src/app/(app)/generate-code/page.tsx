
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
import { Loader2, CodeXml, Wand2, AlertTriangle, Copy, CheckCircle, Settings2, ListOrdered, Trash2, Expand, Minimize, Bug } from 'lucide-react'; // Added Bug
import { ScrollArea } from '@/components/ui/scroll-area';
import { handleGenerateCode, initiateWorkgroupCodeGeneration } from './actions';
import type { HandleGenerateCodeResult } from './actions';
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


const formSchema = z.object({
  prompt: z.string().min(10, 'El prompt debe tener al menos 10 caracteres.'),
  configSource: z.string().min(1, 'Debes seleccionar una fuente de configuración LLM.'),
});

type FormData = z.infer<typeof formSchema>;

export default function GenerateCodePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [generationResult, setGenerationResult] = useState<HandleGenerateCodeResult['data'] | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [promptToConfirm, setPromptToConfirm] = useState<string>("");
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null); 
  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  
  const { addDebugLog } = useDebug();
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
    addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'INFO', message: 'Componente GenerateCodePage montado.' });
    return () => { 
      isMountedRef.current = false; 
      addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'INFO', message: 'Componente GenerateCodePage desmontado.' });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addServerLogsToDebugAndPage = useCallback((serverLogs: string[] | undefined, sourcePrefix: string = 'SERVER_GEN_CODE') => {
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


  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try { setAgents(JSON.parse(storedAgents)); } catch (e) { console.error("Error parsing stored agents:", e); setAgents([]); addDebugLog({source: 'GENERATE_CODE_PAGE', type: 'ERROR', message: 'Error al parsear agentes de localStorage.', data: e});}
    }
    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
      try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); addDebugLog({source: 'GENERATE_CODE_PAGE', type: 'ERROR', message: 'Error al parsear grupos de localStorage.', data: e});}
    }
    setValue('configSource', 'global');
  }, [setValue, addDebugLog]);

  useEffect(() => {
    const options = resolveLlmOptionsForSource(watchedConfigSource, agents, workgroups);
    setResolvedLlmOptions(options);
    addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'DEBUG', message: `Opciones LLM resueltas para ${watchedConfigSource}`, data: options });
  }, [watchedConfigSource, agents, workgroups, addDebugLog]);


  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (!data.configSource.startsWith('workgroup:')) {
        const options = resolveLlmOptionsForSource(data.configSource, agents, workgroups);
        if (!options) {
            toast({
                title: "Configuración LLM Incompleta",
                description: `La configuración LLM seleccionada (${getSourceName(data.configSource)}) está incompleta. Revisa los Ajustes o Agentes.`,
                variant: "destructive",
                duration: 7000,
            });
            addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'ERROR', message: `Configuración LLM para '${getSourceName(data.configSource)}' incompleta.`});
            return;
        }
        setResolvedLlmOptions(options); 
    } else {
        const workgroupId = data.configSource.split(':')[1];
        if (!workgroups.find(wg => wg.id === workgroupId)) {
             toast({ title: "Error de Configuración", description: `Grupo de trabajo '${getSourceName(data.configSource)}' no encontrado.`, variant: "destructive", duration: 7000 });
             addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'ERROR', message: `Grupo de trabajo ${workgroupId} no encontrado para la fuente de configuración.`});
             return;
        }
        setResolvedLlmOptions(null); 
    }
    setPromptToConfirm(data.prompt);
    setIsConfirming(true);
  };

  const proceedWithGeneration = async () => {
    setIsConfirming(false);
    setDetailedLogs([]);
    if (!promptToConfirm) {
        toast({ title: "Error Interno", description: "Falta el prompt.", variant: "destructive" });
        addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'ERROR', message: 'Intento de generación fallido: Falta el prompt.'});
        return;
    };

    setIsLoading(true);
    setGenerationResult(null);
    setGenerationError(null);
    addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'INFO', message: `Iniciando generación de código con prompt: "${promptToConfirm.substring(0, 50)}..."`});
    addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'INFO', message: `Fuente de configuración LLM seleccionada: ${getSourceName(watchedConfigSource)}`});

    let result: HandleGenerateCodeResult;

    if (watchedConfigSource.startsWith('workgroup:')) {
        const workgroupId = watchedConfigSource.split(':')[1];
        if (!workgroups.find(wg => wg.id === workgroupId) || agents.length === 0) {
            addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'ERROR', message: `Error: Grupo de trabajo ${workgroupId} no encontrado o agentes no cargados.`});
            toast({ title: "Error de Configuración de Grupo", description: "Grupo de trabajo no encontrado o agentes no cargados.", variant: "destructive"});
            setIsLoading(false);
            return;
        }
        addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'INFO', message: `Utilizando grupo de trabajo: ${getSourceName(watchedConfigSource)}`});
        
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
        addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'DEBUG', message: `Snapshot de localStorage enviado al servidor para el grupo de trabajo.`});

        result = await initiateWorkgroupCodeGeneration(promptToConfirm, workgroupId, agents, workgroups, snapshot);
        addServerLogsToDebugAndPage(result.workgroupLogs, 'SERVER_WG_GEN_CODE');
    } else {
        if (!resolvedLlmOptions) {
            addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'ERROR', message: `Error: Faltan opciones LLM resueltas para llamada directa.`});
            toast({ title: "Error Interno", description: "Faltan opciones LLM para llamada directa.", variant: "destructive" });
            setIsLoading(false);
            return;
        }
        addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'INFO', message: `Utilizando configuración LLM directa: ${resolvedLlmOptions.providerId} - ${resolvedLlmOptions.modelName}`});
        result = await handleGenerateCode(
            promptToConfirm,
            resolvedLlmOptions.providerId,
            resolvedLlmOptions.apiKey,
            resolvedLlmOptions.modelName,
            resolvedLlmOptions.apiUrl
        );
    }
    
    if (result.success && result.data) {
      setGenerationResult(result.data);
      addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'INFO', message: `Generación completada exitosamente.`, data: result.data });
      toast({ title: 'Generación Completa', description: 'Código generado.', action: <CheckCircle className="text-green-500" /> });
    } else {
      setGenerationError(result.error || 'Ocurrió un error desconocido.');
      addDebugLog({ source: 'GENERATE_CODE_PAGE', type: 'ERROR', message: `Error en la generación: ${result.error || 'Desconocido'}`, data: result});
      toast({ title: 'Generación Fallida', description: result.error || `No se pudo generar código.`, variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleCopyCode = (code: string | undefined) => {
    if (!code) return;
    navigator.clipboard.writeText(code)
      .then(() => toast({ title: 'Código Copiado', description: 'El código ha sido copiado.' }))
      .catch(err => toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar el código.', variant: 'destructive' }));
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
  const canSubmit = isLoading || !currentPrompt || (!resolvedLlmOptions && !isWorkgroupSelected) || (isWorkgroupSelected && workgroups.length === 0 && !workgroups.find(wg => wg.id === watchedConfigSource.split(':')[1]));


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <CodeXml className="h-6 w-6 text-primary" /> Generar Código
          </CardTitle>
          <CardDescription>
            Describe el código que necesitas y la IA lo generará usando la configuración LLM seleccionada.
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
              <Label htmlFor="prompt" className="text-base">Describe tu necesidad:</Label>
              <Textarea id="prompt" {...register('prompt')} rows={8} className="font-mono text-sm bg-card"
                placeholder="Ej: 'Una función en Python que reciba una lista de números y devuelva la suma de los pares.'" />
              {errors.prompt && <p className="text-sm text-destructive mt-1">{errors.prompt.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="configSource" className="text-base flex items-center gap-1"><Settings2 className="h-4 w-4"/> Usar Configuración LLM De:</Label>
                <Controller name="configSource" control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="configSource"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                            <SelectContent>
                                <ScrollArea className="h-[--radix-select-content-available-height] max-h-60"> {/* Added ScrollArea */}
                                    <SelectItem value="global">Ajustes Globales</SelectItem>
                                    {workgroups.map(wg => <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>Grupo: {wg.name}</SelectItem>)}
                                    {agents.map(agent => <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>Agente: {agent.name}</SelectItem>)}
                                </ScrollArea>
                            </SelectContent>
                        </Select>
                    )} />
                {errors.configSource && <p className="text-sm text-destructive mt-1">{errors.configSource.message}</p>}
                 {(!resolvedLlmOptions && !isWorkgroupSelected && watchedConfigSource) && (
                     <p className="text-xs text-destructive mt-1">Configuración para '{getSourceName(watchedConfigSource)}' incompleta. Revisa Ajustes o Agentes.</p>
                )}
                {(isWorkgroupSelected && !workgroups.find(wg => wg.id === watchedConfigSource.split(':')[1])) && (
                    <p className="text-xs text-destructive mt-1">Grupo de trabajo '{getSourceName(watchedConfigSource)}' no encontrado o no disponible.</p>
                )}
            </div>
          </CardContent>
          <CardFooter>
            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
              <AlertDialogTrigger asChild>
                 <Button type="submit" disabled={canSubmit} className="w-full md:w-auto">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Generar Código
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Generación</AlertDialogTitle>
                  <AlertDialogDescription>
                    <p>Generar código con '{getSourceName(watchedConfigSource)}'?</p>
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
                  <AlertDialogAction onClick={proceedWithGeneration}>Sí, Generar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </form>
      </Card>

      {isLoading && (
        <div data-ai-hint="code generation loading" className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-foreground">Generando código...</p>
          <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos.</p>
        </div>
      )}

      {generationError && !isLoading && (
        <Card className="shadow-lg border-destructive bg-destructive/10 mt-6">
          <CardHeader><CardTitle className="text-xl flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" /> Error en Generación</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-destructive">No se pudo generar el código:</p>
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
            <CardTitle className="text-2xl">Código Generado</CardTitle>
            <CardDescription>Generado usando '{getSourceName(watchedConfigSource)}'.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generationResult.explanation && (
              <div>
                <h3 className="text-lg font-semibold mb-1">Explicación:</h3>
                <Card className="bg-muted/50 p-3"><p className="text-sm text-foreground">{generationResult.explanation}</p></Card>
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Fragmento de Código:</h3>
                <Button variant="outline" size="sm" onClick={() => handleCopyCode(generationResult.generatedCode)}><Copy className="mr-2 h-4 w-4" /> Copiar Código</Button>
              </div>
              <ScrollArea className="h-[400px] rounded-md border bg-card p-1">
                <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all text-foreground">{generationResult.generatedCode}</pre>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {detailedLogs.length > 0 && (
          <Card className="mt-6 border-primary/30">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary"><ListOrdered className="h-5 w-5"/> Logs Detallados del Grupo</CardTitle>
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
                  <ScrollArea className={`p-2 border rounded bg-muted/30 transition-all duration-300 ease-in-out ${logsExpanded ? "h-[300px]" : "h-[100px]"}`}>
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

