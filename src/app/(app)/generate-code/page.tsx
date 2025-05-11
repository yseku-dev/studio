
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CodeXml, Wand2, AlertTriangle, Copy, CheckCircle, Settings2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { handleGenerateCode, initiateWorkgroupCodeGeneration } from './actions'; // Import new action
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
import { resolveLlmOptionsForSource } from '@/lib/llm-utils';
import type { LLMOptions } from '@/services/groq';
import { LOCALSTORAGE_AGENTS_KEY, LOCALSTORAGE_WORKGROUPS_KEY } from '@/config/agent-config';

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
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null); // Still useful for direct LLM calls

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);

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
    // For direct LLM calls, we still need resolvedLlmOptions.
    // For workgroups, the server action will handle resolving internal agent LLM options.
    const options = resolveLlmOptionsForSource(watchedConfigSource, agents, workgroups);
    setResolvedLlmOptions(options);
  }, [watchedConfigSource, agents, workgroups]);


  const onSubmit: SubmitHandler<FormData> = async (data) => {
    // If it's not a workgroup, we need resolved LLM options.
    if (!data.configSource.startsWith('workgroup:')) {
        const options = resolveLlmOptionsForSource(data.configSource, agents, workgroups);
        if (!options) {
            toast({
                title: "Configuración LLM Incompleta",
                description: `La configuración LLM seleccionada (${getSourceName(data.configSource)}) está incompleta. Revisa los Ajustes o Agentes.`,
                variant: "destructive",
                duration: 7000,
            });
            return;
        }
        setResolvedLlmOptions(options); // Store for direct call
    } else {
        setResolvedLlmOptions(null); // Not needed for workgroup call directly here
    }
    setPromptToConfirm(data.prompt);
    setIsConfirming(true);
  };

  const proceedWithGeneration = async () => {
    setIsConfirming(false);
    if (!promptToConfirm) {
        toast({ title: "Error Interno", description: "Falta el prompt.", variant: "destructive" });
        return;
    };

    setIsLoading(true);
    setGenerationResult(null);
    setGenerationError(null);

    let result: HandleGenerateCodeResult;

    if (watchedConfigSource.startsWith('workgroup:')) {
        const workgroupId = watchedConfigSource.split(':')[1];
        if (!workgroups.find(wg => wg.id === workgroupId) || agents.length === 0) {
            toast({ title: "Error de Configuración de Grupo", description: "Grupo de trabajo no encontrado o agentes no cargados.", variant: "destructive"});
            setIsLoading(false);
            return;
        }
        result = await initiateWorkgroupCodeGeneration(promptToConfirm, workgroupId, agents, workgroups);
    } else {
        if (!resolvedLlmOptions) {
            toast({ title: "Error Interno", description: "Faltan opciones LLM para llamada directa.", variant: "destructive" });
            setIsLoading(false);
            return;
        }
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
      toast({ title: 'Generación Completa', description: 'Código generado.', action: <CheckCircle className="text-green-500" /> });
    } else {
      setGenerationError(result.error || 'Ocurrió un error desconocido.');
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
  const canSubmit = isLoading || !currentPrompt || (!resolvedLlmOptions && !isWorkgroupSelected) || (isWorkgroupSelected && workgroups.length === 0);


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
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Generar Código
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Generación</AlertDialogTitle>
                  <AlertDialogDescription>
                    Generar código con '{getSourceName(watchedConfigSource)}'?
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
    </div>
  );
}
