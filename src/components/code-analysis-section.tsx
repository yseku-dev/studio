
'use client';

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { handleAnalyzeCode } from '@/app/(app)/analyze/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Save, UploadCloud, XCircle, AlertTriangle, Copy, Settings2, Link as LinkIcon, Github } from 'lucide-react'; // Added LinkIcon
import { ScrollArea } from './ui/scroll-area';
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

const formSchema = z.object({
  code: z.string().min(10, 'El código debe tener al menos 10 caracteres.'),
  configSource: z.string().min(1, 'Debes seleccionar una fuente de configuración LLM.'),
  gitFileUrl: z.string().url({ message: "Por favor, introduce una URL válida." }).optional().or(z.literal('')), // New field for Git file URL
});

type FormData = z.infer<typeof formSchema>;

interface AnalysisResult {
  codeSuggestion: string;
  explanation: string;
}

interface CodeAnalysisSectionProps {
  onSaveSnapshot: (code: string, nameSuffix: string) => void;
}

export function CodeAnalysisSection({ onSaveSnapshot }: CodeAnalysisSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingGitFile, setIsFetchingGitFile] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [originalCode, setOriginalCode] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null);

  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    control,
    getValues, // To get gitFileUrl
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '', configSource: 'global', gitFileUrl: '' }
  });

  const codeValue = watch('code');
  const watchedConfigSource = watch('configSource');
  const watchedGitFileUrl = watch('gitFileUrl');

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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setValue('code', content, { shouldValidate: true });
        setFileName(file.name);
        setValue('gitFileUrl', ''); // Clear Git URL if file is uploaded
        toast({ title: 'Archivo Cargado', description: `Contenido de "${file.name}" cargado.` });
      };
      reader.onerror = () => toast({ title: 'Error al Leer Archivo', variant: 'destructive' });
      reader.readAsText(file);
    } else {
      if (fileName) { setValue('code', ''); setFileName(null); }
    }
    event.target.value = '';
  };

  const clearFile = () => {
    setValue('code', ''); setFileName(null);
    toast({ title: 'Archivo Eliminado', description: 'Contenido eliminado del área de texto.' });
  };

  const handleFetchFromGitUrl = async () => {
    const url = getValues('gitFileUrl');
    if (!url || !url.trim()) {
      toast({ title: "URL Vacía", description: "Por favor, introduce una URL de archivo Git.", variant: "destructive" });
      return;
    }
    setIsFetchingGitFile(true);
    toast({ title: "Obteniendo Archivo...", description: `Intentando obtener contenido de ${url}`});
    try {
      // Attempt to construct a raw URL for GitHub, GitLab, Bitbucket
      let rawUrl = url;
      if (url.includes("github.com") && !url.includes("/raw/")) {
        rawUrl = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
      } else if (url.includes("gitlab.com") && !url.includes("/-/raw/")) {
        rawUrl = url.replace("/blob/", "/-/raw/");
      } else if (url.includes("bitbucket.org") && !url.includes("?raw=true")) {
         rawUrl = url.replace("/src/", "/raw/") + "?raw=true"; // Common pattern, might vary
      }
      
      const response = await fetch(rawUrl);
      if (!response.ok) {
        throw new Error(`Error al obtener el archivo: ${response.status} ${response.statusText}. Asegúrate de que la URL sea a un archivo raw accesible.`);
      }
      const content = await response.text();
      setValue('code', content, { shouldValidate: true });
      setFileName(url.substring(url.lastIndexOf('/') + 1));
      setValue('gitFileUrl', url); // Keep the original URL for reference
      toast({ title: "Archivo Obtenido", description: `Contenido de ${fileName || url} cargado en el editor.` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido al obtener el archivo.";
      toast({ title: "Error al Obtener Archivo Git", description: errorMessage, variant: "destructive", duration: 7000 });
      console.error("Error fetching Git file:", error);
    } finally {
      setIsFetchingGitFile(false);
    }
  };


  const onSubmit: SubmitHandler<FormData> = async (data) => {
    const options = resolvedLlmOptions;
     if (!options && !data.configSource.startsWith('workgroup:')) {
        toast({
            title: "Configuración LLM Incompleta",
            description: `Configuración para '${getSourceName(data.configSource)}' incompleta. Revisa Ajustes, Agentes o Grupos.`,
            variant: "destructive", duration: 7000,
        }); return;
     }
     if (data.configSource.startsWith('workgroup:') && !workgroups.find(wg => wg.id === data.configSource.split(':')[1])) {
        toast({ title: "Error de Configuración", description: `Grupo de trabajo '${getSourceName(data.configSource)}' no encontrado.`, variant: "destructive", duration: 7000 });
        return;
     }

    setIsLoading(true); setAnalysisResult(null); setAnalysisError(null); setOriginalCode(data.code);

    if (data.configSource.startsWith('workgroup:')) {
      // const workgroupId = data.configSource.split(':')[1];
      toast({ title: "Análisis con Grupo de Trabajo", description: "Funcionalidad pendiente de implementación para análisis de código con grupos.", duration: 5000});
      // TODO: Implement workgroup analysis logic
      setIsLoading(false); 
      return; 
    }

    if (!options) {
      toast({ title: "Error Interno", description: "Faltan opciones LLM para llamada directa.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    const result = await handleAnalyzeCode(data.code, options.providerId, options.apiKey, options.modelName, options.apiUrl);

    if (result.success && result.data) {
      setAnalysisResult(result.data);
      toast({ title: 'Análisis Completo', description: 'Sugerencias generadas.' });
    } else {
      setAnalysisError(result.error || 'Ocurrió un error desconocido.');
      toast({ title: 'Análisis Fallido', description: result.error || `No se pudieron generar sugerencias.`, variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleSaveOriginal = () => originalCode ? onSaveSnapshot(originalCode, "original") : toast({ title: "Nada que guardar", variant: "destructive" });
  const handleSaveSuggestion = () => analysisResult?.codeSuggestion ? onSaveSnapshot(analysisResult.codeSuggestion, "sugerido") : toast({ title: "Nada que guardar", variant: "destructive" });

  const handleCopyError = (errorText: string | undefined) => {
    if (!errorText) return;
    navigator.clipboard.writeText(errorText)
      .then(() => toast({ title: 'Error Copiado' }))
      .catch(() => toast({ title: 'Fallo al Copiar', variant: 'destructive' }));
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
  const canSubmit = isLoading || !codeValue || (!resolvedLlmOptions && !isWorkgroupSelected) || (isWorkgroupSelected && workgroups.length === 0 && !workgroups.find(wg => wg.id === watchedConfigSource.split(':')[1]));


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" /> Analiza Tu Código
          </CardTitle>
          <CardDescription>
            Pega código, sube un archivo, o introduce una URL de archivo Git para obtener sugerencias usando config LLM seleccionada.
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label htmlFor="code-file" className="text-base flex items-center gap-2"><UploadCloud className="h-5 w-5" /> Sube archivo (opcional)</Label>
                  <div className="flex items-center gap-2">
                      <Input id="code-file" type="file" onChange={handleFileChange} className="text-base file:text-base flex-grow"
                          accept=".py,.js,.ts,.jsx,.tsx,.java,.c,.cpp,.cs,.go,.php,.rb,.rs,.swift,.kt,.html,.css,.json,.md,.txt"/>
                      {fileName && (<Button variant="ghost" size="icon" onClick={clearFile} title="Eliminar"><XCircle className="h-5 w-5 text-muted-foreground hover:text-destructive" /></Button>)}
                  </div>
                  {fileName && <p className="text-sm text-muted-foreground">Cargado: <span className="font-medium text-foreground">{fileName}</span>.</p>}
              </div>
               <div className="space-y-2">
                <Label htmlFor="gitFileUrl" className="text-base flex items-center gap-2"><Github className="h-5 w-5" /> URL de Archivo Git (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input id="gitFileUrl" {...register('gitFileUrl')} placeholder="Ej: https://github.com/usuario/repo/raw/main/archivo.ts" className="bg-card text-foreground flex-grow"/>
                  <Button type="button" onClick={handleFetchFromGitUrl} disabled={isFetchingGitFile || !watchedGitFileUrl?.trim()} variant="outline" size="sm">
                    {isFetchingGitFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />} Obtener
                  </Button>
                </div>
                {errors.gitFileUrl && <p className="text-sm text-destructive mt-1">{errors.gitFileUrl.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="configSourceCodeAnalysis" className="text-base flex items-center gap-1"><Settings2 className="h-4 w-4"/> Usar Configuración LLM De:</Label>
                <Controller name="configSource" control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="configSourceCodeAnalysis"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                            <SelectContent>
                                <ScrollArea className="h-[--radix-select-content-available-height] max-h-60"> 
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
            <div className="mt-4">
              <Label htmlFor="code">Entrada de Código</Label>
              <Textarea id="code" {...register('code')} rows={15} className="font-mono text-sm bg-card mt-1" placeholder="Pega tu código aquí, sube un archivo o introduce una URL de Git..." />
              {errors.code && (<p className="text-sm text-destructive mt-1">{errors.code.message}</p>)}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={canSubmit} className="w-full md:w-auto">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Analizar Código
            </Button>
          </CardFooter>
        </form>
      </Card>

      {analysisError && !isLoading && (
        <Card className="shadow-lg border-destructive bg-destructive/10">
          <CardHeader><CardTitle className="text-xl flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" /> Error en Análisis</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-destructive">No se pudo completar el análisis:</p>
            <ScrollArea className="h-[100px] p-2 border border-destructive/30 rounded bg-background/50"><pre className="text-xs text-foreground whitespace-pre-wrap">{analysisError}</pre></ScrollArea>
            <Button variant="outline" size="sm" onClick={() => handleCopyError(analysisError)} className="mt-2 text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground">
                <Copy className="mr-2 h-4 w-4"/> Copiar Error
            </Button>
          </CardContent>
        </Card>
      )}

      {analysisResult && !isLoading && !analysisError && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Resultados del Análisis</CardTitle>
             <CardDescription>Analizado usando '{getSourceName(watchedConfigSource)}'.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Explicación</h3>
              <Card className="bg-muted/50"><CardContent className="p-4"><p className="text-sm">{analysisResult.explanation}</p></CardContent></Card>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold">Código Original</h3>
                    <Button variant="outline" size="sm" onClick={handleSaveOriginal} disabled={!originalCode}><Save className="mr-2 h-4 w-4" /> Guardar</Button>
                </div>
                <ScrollArea className="h-[400px] rounded-md border bg-card p-1"><pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all">{originalCode}</pre></ScrollArea>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold">Código Sugerido</h3>
                    <Button variant="outline" size="sm" onClick={handleSaveSuggestion} disabled={!analysisResult.codeSuggestion}><Save className="mr-2 h-4 w-4" /> Guardar</Button>
                </div>
                <ScrollArea className="h-[400px] rounded-md border bg-card p-1"><pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all">{analysisResult.codeSuggestion}</pre></ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

