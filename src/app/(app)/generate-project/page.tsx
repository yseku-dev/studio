
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form'; // Import Controller
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FolderPlus, Wand2, AlertTriangle, DownloadCloud, CheckCircle, FileText, ListTree, Copy, Settings2 } from 'lucide-react'; // Added Settings2
import { ScrollArea } from '@/components/ui/scroll-area';
import { handleGenerateProject } from './actions';
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
} from "@/components/ui/select"; // Import Select components
import type { AgentConfig } from '@/types/agent';
import { resolveLlmOptionsForSource } from '@/lib/llm-utils'; // Import the helper
import type { LLMOptions } from '@/services/groq'; // Import LLMOptions type
import { LOCALSTORAGE_AGENTS_KEY } from '@/config/agent-config'; // Import agents key


const formSchema = z.object({
  prompt: z.string().min(15, 'El prompt debe tener al menos 15 caracteres para describir un proyecto.'),
  configSource: z.string().min(1, 'Debes seleccionar una fuente de configuración LLM.'), // Add config source validation
});

type FormData = z.infer<typeof formSchema>;

export default function GenerateProjectPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [generationResult, setGenerationResult] = useState<HandleGenerateProjectResult['data'] | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [promptToConfirm, setPromptToConfirm] = useState<string>("");
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null); // State for resolved options

  // Agent and config source state
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global'); // Default to global

  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control, // Need control for Select
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
      configSource: 'global', // Set default value
    }
  });

  const currentPrompt = watch('prompt');
  const watchedConfigSource = watch('configSource');

   // Load agents from localStorage
  useEffect(() => {
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try {
        setAgents(JSON.parse(storedAgents));
      } catch (e) {
        console.error("Error parsing stored agents:", e);
        setAgents([]);
      }
    }
     // Set default value for the form after agents are potentially loaded
    setValue('configSource', 'global');
  }, [setValue]);

  // Update resolved LLM options when config source or agents change
  useEffect(() => {
    const options = resolveLlmOptionsForSource(watchedConfigSource, agents);
    setResolvedLlmOptions(options);
  }, [watchedConfigSource, agents]);


  const onSubmit: SubmitHandler<FormData> = async (data) => {
     const options = resolveLlmOptionsForSource(data.configSource, agents);
     if (!options) {
        toast({
            title: "Configuración LLM Incompleta",
            description: `La configuración LLM seleccionada (${data.configSource === 'global' ? 'Global' : agents.find(a => a.id === data.configSource)?.name || 'Agente Desconocido'}) está incompleta o no se pudo resolver. Revisa los Ajustes o la configuración del Agente.`,
            variant: "destructive",
            duration: 7000,
        });
        return;
     }
     setResolvedLlmOptions(options); // Store resolved options for confirmation/generation
    setPromptToConfirm(data.prompt);
    setIsConfirming(true);
  };

  const proceedWithGeneration = async () => {
    setIsConfirming(false);
    if (!promptToConfirm || !resolvedLlmOptions) {
         toast({
            title: "Error Interno",
            description: "Falta el prompt o las opciones LLM resueltas.",
            variant: "destructive",
        });
        return;
    }

    setIsLoading(true);
    setGenerationResult(null);
    setGenerationError(null);

    // Use the resolved LLM options
    const result = await handleGenerateProject(
        promptToConfirm,
        resolvedLlmOptions.providerId,
        resolvedLlmOptions.apiKey,
        resolvedLlmOptions.modelName,
        resolvedLlmOptions.apiUrl
    );


    if (result.success && result.data) {
      setGenerationResult(result.data);
      toast({
        title: 'Generación de Proyecto Completa',
        description: 'Estructura de proyecto generada exitosamente.',
        action: <CheckCircle className="text-green-500" />
      });
    } else {
      setGenerationError(result.error || 'Ocurrió un error desconocido durante la generación del proyecto.');
      toast({
        title: 'Generación de Proyecto Fallida',
        description: result.error || `No se pudo generar la estructura del proyecto con ${resolvedLlmOptions.providerId}. Revisa el mensaje de error.`,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleDownloadProject = async () => {
    if (!generationResult || !generationResult.projectStructure || generationResult.projectStructure.files.length === 0) {
      toast({
        title: 'Nada que Descargar',
        description: 'No hay archivos de proyecto generados para descargar.',
        variant: 'destructive',
      });
      return;
    }
    setIsDownloading(true);
    toast({ title: 'Preparando Descarga', description: 'Creando archivo ZIP del proyecto...' });

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
      toast({
        title: "Descarga Iniciada",
        description: `El proyecto ${a.download} se está descargando.`
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Error desconocido";
      toast({
        title: "Error al Crear ZIP",
        description: `No se pudo crear el archivo ZIP: ${error}`,
        variant: "destructive",
      });
      console.error("Error al crear ZIP:", e);
    }
    setIsDownloading(false);
  };

  const handleCopyError = (errorText: string | undefined) => {
    if (!errorText) return;
    navigator.clipboard.writeText(errorText)
      .then(() => {
        toast({ title: 'Error Copiado', description: 'El mensaje de error ha sido copiado al portapapeles.' });
      })
      .catch(err => {
        console.error('Error al copiar el error:', err);
        toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar el error al portapapeles.', variant: 'destructive' });
      });
  };

   const getSourceName = (sourceId: string): string => {
    if (sourceId === 'global') return 'Global';
    return agents.find(a => a.id === sourceId)?.name || 'Desconocido';
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <FolderPlus className="h-6 w-6 text-primary" />
            Generar Proyecto
          </CardTitle>
          <CardDescription>
            Describe la estructura y el tipo de proyecto que necesitas, y la IA generará un borrador usando la configuración LLM seleccionada.
            {!resolvedLlmOptions && watchedConfigSource ? (
                 <span className="text-destructive block mt-1"> (Configuración LLM para '{getSourceName(watchedConfigSource)}' incompleta o inválida)</span>
             ) : resolvedLlmOptions ? (
                <span className="text-foreground block mt-1">(Usando: {getSourceName(watchedConfigSource)} - {resolvedLlmOptions.providerId} - {resolvedLlmOptions.modelName})</span>
             ) : (
                 <span className="text-muted-foreground block mt-1">(Selecciona una fuente de configuración)</span>
             )}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-base">Describe tu proyecto:</Label>
              <Textarea
                id="prompt"
                {...register('prompt')}
                rows={10}
                className="font-mono text-sm bg-card"
                placeholder="Ej: 'Un proyecto simple de API REST con Express.js y TypeScript. Incluir una ruta GET /health y una ruta POST /users. Configuración básica de ESLint y Prettier.'"
              />
              {errors.prompt && (
                <p className="text-sm text-destructive mt-1">{errors.prompt.message}</p>
              )}
            </div>

             {/* LLM Configuration Source Selector */}
            <div className="space-y-2">
                <Label htmlFor="configSource" className="text-base flex items-center gap-1">
                   <Settings2 className="h-4 w-4"/> Usar Configuración LLM De:
                </Label>
                <Controller
                    name="configSource"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="configSource">
                                <SelectValue placeholder="Seleccionar fuente de configuración" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="global">Ajustes Globales</SelectItem>
                                {agents.map(agent => (
                                    <SelectItem key={agent.id} value={agent.id}>
                                        Agente: {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.configSource && <p className="text-sm text-destructive mt-1">{errors.configSource.message}</p>}
                 {!resolvedLlmOptions && watchedConfigSource && (
                     <p className="text-xs text-destructive mt-1">La configuración para '{getSourceName(watchedConfigSource)}' parece incompleta. Revisa los <a href="/settings" className="underline">Ajustes Globales</a> o la configuración del agente en <a href="/agents" className="underline">Gestión de Agentes</a>.</p>
                )}
            </div>

          </CardContent>
          <CardFooter>
            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
              <AlertDialogTrigger asChild>
                <Button type="submit" disabled={isLoading || !currentPrompt || !resolvedLlmOptions} className="w-full md:w-auto">
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Generar Proyecto
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Generación de Proyecto</AlertDialogTitle>
                   <AlertDialogDescription>
                    ¿Estás seguro de que deseas generar la estructura de un proyecto basado en el siguiente prompt usando la configuración de '{getSourceName(watchedConfigSource)}'?
                    <div className="mt-1 text-xs text-muted-foreground">
                        (Proveedor: {resolvedLlmOptions?.providerId}, Modelo: {resolvedLlmOptions?.modelName})
                    </div>
                    <ScrollArea className="h-[150px] mt-2 p-2 border rounded bg-muted/30">
                        <pre className="text-xs text-foreground whitespace-pre-wrap">{promptToConfirm}</pre>
                    </ScrollArea>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setPromptToConfirm("")}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={proceedWithGeneration}>
                    Sí, Generar Proyecto
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </form>
      </Card>

      {isLoading && (
        <div
          data-ai-hint="project generation loading"
          className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6"
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-foreground">Generando estructura de proyecto...</p>
          <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos, especialmente para descripciones complejas.</p>
        </div>
      )}

      {generationError && !isLoading && (
        <Card className="shadow-lg border-destructive bg-destructive/10 mt-6">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              Error en la Generación del Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-destructive">No se pudo completar la generación de la estructura del proyecto:</p>
             <ScrollArea className="h-[100px] p-2 border border-destructive/30 rounded bg-background/50">
                <pre className="text-xs text-foreground whitespace-pre-wrap">{generationError}</pre>
            </ScrollArea>
            <Button variant="outline" size="sm" onClick={() => handleCopyError(generationError)} className="mt-2 text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground">
                <Copy className="mr-2 h-4 w-4"/> Copiar Mensaje de Error
            </Button>
          </CardContent>
        </Card>
      )}

      {generationResult && !isLoading && !generationError && (
        <Card className="shadow-lg mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="text-2xl">Proyecto Generado: {generationResult.projectStructure.projectName || "Sin Nombre"}</CardTitle>
                <Button
                    onClick={handleDownloadProject}
                    disabled={isDownloading || !generationResult.projectStructure.files?.length}
                    variant="outline"
                >
                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
                    Descargar Proyecto (ZIP)
                </Button>
            </div>
            <CardDescription>Generado usando la configuración de '{getSourceName(watchedConfigSource)}'.</CardDescription>
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
                <p className="text-muted-foreground">La IA no generó ningún archivo para este proyecto.</p>
             )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
