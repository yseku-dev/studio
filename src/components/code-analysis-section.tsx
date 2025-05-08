'use client';

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form'; // Import Controller
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { handleAnalyzeCode } from '@/app/(app)/analyze/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Save, UploadCloud, XCircle, AlertTriangle, Copy, Settings2 } from 'lucide-react'; // Added Settings2
import { ScrollArea } from './ui/scroll-area';
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
  code: z.string().min(10, 'El código debe tener al menos 10 caracteres.'),
  configSource: z.string().min(1, 'Debes seleccionar una fuente de configuración LLM.'), // Add config source validation
});

type FormData = z.infer<typeof formSchema>;

interface AnalysisResult {
  codeSuggestion: string;
  explanation: string;
}

interface CodeAnalysisSectionProps {
  onSaveSnapshot: (code: string, nameSuffix: string) => void;
  // Removed LLM props: llmProviderId, apiKey, modelName, apiUrl
}

export function CodeAnalysisSection({
    onSaveSnapshot,
}: CodeAnalysisSectionProps) {

  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [originalCode, setOriginalCode] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null); // State for resolved options

  // Agent and config source state
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global'); // Default to global

  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    control, // Need control for Select
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      configSource: 'global', // Set default value
    }
  });

  const codeValue = watch('code');
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
     // Update the local selectedConfigSource state if needed for display, although watching the form value is often sufficient
    setSelectedConfigSource(watchedConfigSource);
  }, [watchedConfigSource, agents]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setValue('code', content, { shouldValidate: true });
        setFileName(file.name);
        toast({
          title: 'Archivo Cargado',
          description: `Contenido de "${file.name}" cargado en el área de texto.`,
        });
      };
      reader.onerror = () => {
        toast({
          title: 'Error al Leer Archivo',
          description: 'No se pudo leer el contenido del archivo.',
          variant: 'destructive',
        });
        setFileName(null);
      };
      reader.readAsText(file);
    } else {
      if (fileName) {
        setValue('code', '');
        setFileName(null);
      }
    }
     // Reset file input value to allow re-uploading the same file
    event.target.value = '';
  };

  const clearFile = () => {
    setValue('code', '');
    setFileName(null);
    toast({
        title: 'Archivo Eliminado',
        description: 'El contenido del archivo ha sido eliminado del área de texto.',
    });
  };


  const onSubmit: SubmitHandler<FormData> = async (data) => {
    const options = resolvedLlmOptions; // Use the state which reflects the selected source
     if (!options) {
        toast({
            title: "Configuración LLM Incompleta",
            description: `La configuración LLM seleccionada (${getSourceName(selectedConfigSource)}) está incompleta o no se pudo resolver. Revisa los Ajustes o la configuración del Agente.`,
            variant: "destructive",
            duration: 7000,
        });
        return;
     }

    setIsLoading(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    setOriginalCode(data.code);

    // Pass the resolved LLM options to the server action
    const result = await handleAnalyzeCode(
        data.code,
        options.providerId,
        options.apiKey,
        options.modelName,
        options.apiUrl
    );

    if (result.success && result.data) {
      setAnalysisResult(result.data);
      toast({
        title: 'Análisis Completo',
        description: 'Sugerencias generadas exitosamente.',
      });
    } else {
      setAnalysisError(result.error || 'Ocurrió un error desconocido durante el análisis.');
      toast({
        title: 'Análisis Fallido',
        description: result.error || `No se pudieron generar sugerencias con ${options.providerId}. Revisa el mensaje de error.`,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleSaveOriginal = () => {
    if (originalCode) {
      onSaveSnapshot(originalCode, "original");
    } else {
      toast({ title: "Nada que guardar", description: "El código original está vacío.", variant: "destructive" });
    }
  };

  const handleSaveSuggestion = () => {
    if (analysisResult?.codeSuggestion) {
      onSaveSnapshot(analysisResult.codeSuggestion, "sugerido");
    } else {
      toast({ title: "Nada que guardar", description: "No hay sugerencia de código disponible.", variant: "destructive" });
    }
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
            <Wand2 className="h-6 w-6 text-primary" />
            Analiza Tu Código
          </CardTitle>
          <CardDescription>
            Pega tu código abajo o sube un archivo para obtener sugerencias de mejora potenciadas por IA usando la configuración LLM seleccionada.
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
                <Label htmlFor="code-file" className="text-base flex items-center gap-2">
                    <UploadCloud className="h-5 w-5" /> Sube un archivo de código (opcional)
                </Label>
                <div className="flex items-center gap-2">
                    <Input
                        id="code-file"
                        type="file"
                        onChange={handleFileChange}
                        className="text-base file:text-base flex-grow"
                        accept=".py,.js,.ts,.jsx,.tsx,.java,.c,.cpp,.cs,.go,.php,.rb,.rs,.swift,.kt,.html,.css,.json,.md, .txt"
                    />
                    {fileName && (
                        <Button variant="ghost" size="icon" onClick={clearFile} title="Eliminar archivo cargado">
                            <XCircle className="h-5 w-5 text-muted-foreground hover:text-destructive" />
                        </Button>
                    )}
                </div>
                {fileName && <p className="text-sm text-muted-foreground">Archivo cargado: <span className="font-medium text-foreground">{fileName}</span>. Su contenido está en el área de texto.</p>}
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


            <div className="mt-4">
              <Label htmlFor="code">Entrada de Código</Label>
              <Textarea
                id="code"
                {...register('code')}
                rows={15}
                className="font-mono text-sm bg-card mt-1"
                placeholder="Pega tu código aquí o sube un archivo..."
              />
              {errors.code && (
                <p className="text-sm text-destructive mt-1">{errors.code.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || !codeValue || !resolvedLlmOptions} className="w-full md:w-auto">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Analizar Código
            </Button>
          </CardFooter>
        </form>
      </Card>

      {analysisError && !isLoading && (
        <Card className="shadow-lg border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              Error en el Análisis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-destructive">No se pudo completar el análisis del código:</p>
            <ScrollArea className="h-[100px] p-2 border border-destructive/30 rounded bg-background/50">
                <pre className="text-xs text-foreground whitespace-pre-wrap">{analysisError}</pre>
            </ScrollArea>
            <Button variant="outline" size="sm" onClick={() => handleCopyError(analysisError)} className="mt-2 text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground">
                <Copy className="mr-2 h-4 w-4"/> Copiar Mensaje de Error
            </Button>
          </CardContent>
        </Card>
      )}

      {analysisResult && !isLoading && !analysisError && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Resultados del Análisis</CardTitle>
             <CardDescription>Analizado usando la configuración de '{getSourceName(selectedConfigSource)}'.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Explicación</h3>
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm">{analysisResult.explanation}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold">Código Original</h3>
                    <Button variant="outline" size="sm" onClick={handleSaveOriginal} disabled={!originalCode}>
                        <Save className="mr-2 h-4 w-4" /> Guardar Versión
                    </Button>
                </div>
                <ScrollArea className="h-[400px] rounded-md border bg-card p-1">
                  <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all">{originalCode}</pre>
                </ScrollArea>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold">Código Sugerido</h3>
                    <Button variant="outline" size="sm" onClick={handleSaveSuggestion} disabled={!analysisResult.codeSuggestion}>
                        <Save className="mr-2 h-4 w-4" /> Guardar Versión
                    </Button>
                </div>
                <ScrollArea className="h-[400px] rounded-md border bg-card p-1">
                  <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all">{analysisResult.codeSuggestion}</pre>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
