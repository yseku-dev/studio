
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, DownloadCloud, FileCode, Wand2, CheckCircle, XCircle, Info } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { handleAutoAnalyzeAppSource, getApplicationSourceBundle, applySuggestedChange } from './actions';
import type { AnalyzeCodeAlchemistSourceOutput, AnalyzeCodeAlchemistSourceInput } from '@/ai/flows/analyze-codealchemist-source-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Textarea } from '@/components/ui/textarea';


type AutoUpdateStatus = "idle" | "loading_source" | "analyzing" | "success" | "error";
type SuggestionStatus = "pending" | "applying" | "applied" | "error_applying";

interface SuggestionWithStatus extends AnalyzeCodeAlchemistSourceOutput['suggestions'][0] {
  id: string;
  status: SuggestionStatus;
  errorMessage?: string;
  // Para poder aplicar el cambio, necesitamos el contenido original del archivo al que se refiere.
  // Esto es una simplificación; idealmente, el LLM debería devolver el contenido original modificado
  // o un diff aplicable. Por ahora, asumiremos que 'area' es el nombre del archivo.
  originalContent?: string; 
  suggestedContent?: string; // Y el contenido sugerido completo.
}


export default function AutoUpdatePage() {
  const [status, setStatus] = useState<AutoUpdateStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeAlchemistSourceOutput | null>(null);
  const [suggestionsWithStatus, setSuggestionsWithStatus] = useState<SuggestionWithStatus[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [projectFiles, setProjectFiles] = useState<Awaited<ReturnType<typeof getApplicationSourceBundle>>['data']>([]);
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem('codealchemist_groq_api_key'));
    setModelName(localStorage.getItem('codealchemist_groq_model_name'));
  }, []);

  const fetchProjectFiles = async () => {
     const bundleResult = await getApplicationSourceBundle();
     if (bundleResult.success && bundleResult.files) {
       setProjectFiles(bundleResult.files);
     } else {
       toast({ title: "Error", description: "No se pudieron cargar los archivos del proyecto para la referencia de sugerencias.", variant: "destructive" });
     }
  };

  const handleStartAutoAnalysis = async () => {
    if (!apiKey || !modelName) {
      toast({
        title: 'Configuración Faltante',
        description: 'Por favor, establece tu Clave API de Groq y Nombre de Modelo en Configuración.',
        variant: 'destructive',
      });
      return;
    }

    setStatus("analyzing");
    setAnalysisResult(null);
    setSuggestionsWithStatus([]);
    toast({
      title: "Auto-Análisis Iniciado",
      description: "Analizando el código fuente completo de CodeAlchemist..."
    });

    await fetchProjectFiles(); // Cargar archivos para referencia antes de que las sugerencias se procesen

    const result = await handleAutoAnalyzeAppSource(apiKey, modelName);

    if (result.success && result.data) {
      setAnalysisResult(result.data);
      // Aquí necesitaríamos una lógica más sofisticada para mapear `area` a contenido real.
      // Por ahora, intentaremos encontrar el archivo.
      const initialSuggestions = result.data.suggestions.map((s, index) => {
        const relatedFile = projectFiles?.find(f => f.fileName.includes(s.area));
        return {
          ...s,
          id: `suggestion-${index}-${Date.now()}`,
          status: "pending" as SuggestionStatus,
          originalContent: relatedFile?.content, // Puede ser undefined si no se encuentra
          // El LLM debería devolver el CÓDIGO COMPLETO SUGERIDO para el archivo, no solo la sugerencia de cambio.
          // Esto es una GRAN SIMPLIFICACIÓN.
          suggestedContent: `// --- CONTENIDO ORIGINAL DE ${s.area} ---\n${relatedFile?.content}\n\n// --- SUGERENCIA APLICADA ---\n// ${s.suggestion}\n// (Este es un marcador de posición. El LLM debe proporcionar el archivo completo modificado.)`
        };
      });
      setSuggestionsWithStatus(initialSuggestions);
      setStatus("success");
      toast({
        title: "Auto-Análisis Completado",
        description: "Se han generado sugerencias para CodeAlchemist."
      });
    } else {
      setStatus("error");
      toast({
        title: "Error en Auto-Análisis",
        description: result.error || "Ocurrió un error desconocido.",
        variant: "destructive",
      });
    }
  };

  const handleApplySuggestion = async (suggestionId: string) => {
    const suggestionIndex = suggestionsWithStatus.findIndex(s => s.id === suggestionId);
    if (suggestionIndex === -1) return;

    const suggestionToApply = suggestionsWithStatus[suggestionIndex];
    if (!suggestionToApply.originalContent || !suggestionToApply.suggestedContent) {
        toast({ title: "Error", description: `No se encontró el contenido original o sugerido para ${suggestionToApply.area}. No se puede aplicar.`, variant: "destructive" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying" as SuggestionStatus, errorMessage: "Falta contenido original o sugerido."} : s));
        return;
    }

    setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "applying" as SuggestionStatus} : s));
    
    toast({ title: "Aplicando Sugerencia...", description: `Aplicando cambio a ${suggestionToApply.area}` });

    // SIMULACIÓN: En una app real, aquí llamarías a `applySuggestedChange`
    // const result = await applySuggestedChange(suggestionToApply.area, suggestionToApply.originalContent, suggestionToApply.suggestedContent);
    
    // Para esta simulación, solo marcamos como aplicado después de un tiempo.
    await new Promise(resolve => setTimeout(resolve, 1000));
    const result = { success: true, newContent: suggestionToApply.suggestedContent }; // Resultado simulado


    if (result.success) {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "applied" as SuggestionStatus, originalContent: result.newContent } : s));
      toast({ title: "Sugerencia Aplicada (Simulado)", description: `El cambio para ${suggestionToApply.area} se ha simulado como aplicado.`});
      // Actualizar el archivo en projectFiles localmente si es necesario para futuras referencias
      setProjectFiles(prevFiles => prevFiles.map(pf => pf.fileName === suggestionToApply.area ? {...pf, content: result.newContent!} : pf));
    } else {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying" as SuggestionStatus, errorMessage: result.error} : s));
      toast({ title: "Error al Aplicar (Simulado)", description: result.error || `No se pudo aplicar el cambio a ${suggestionToApply.area}.`, variant: "destructive"});
    }
  };


  const handleDownloadSource = async () => {
    setIsDownloading(true);
    toast({
      title: "Preparando Descarga",
      description: "Recopilando todos los archivos fuente de CodeAlchemist..."
    });

    const result = await getApplicationSourceBundle(); // No concatenar para descarga

    if (result.success && result.files) {
      try {
        // Crear un zip en el cliente es complejo, por ahora descargaremos un JSON con todos los archivos.
        // Para una descarga de zip real, se necesitaría una biblioteca como JSZip.
        const bundleJsonString = JSON.stringify(result.files, null, 2);
        const blob = new Blob([bundleJsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'codealchemist-full-source-bundle.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Descarga Iniciada",
          description: "El paquete completo de código fuente (codealchemist-full-source-bundle.json) se está descargando."
        });
      } catch (e) {
         toast({
          title: "Error al Crear Descarga",
          description: "No se pudo crear el archivo de descarga en el navegador.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Error al Obtener Código Fuente",
        description: result.error || "No se pudo obtener el paquete de código fuente.",
        variant: "destructive",
      });
    }
    setIsDownloading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            AutoUpdate: Análisis de CodeAlchemist
          </CardTitle>
          <CardDescription className="text-lg">
            Esta sección permite a la IA analizar el propio código fuente completo de la aplicación CodeAlchemist para proponer mejoras y optimizaciones.
             {!apiKey || !modelName ? (
                <span className="text-destructive block mt-1"> (Clave API o Modelo no configurado en Ajustes)</span>
            ) : <span className="text-muted-foreground block mt-1">(Usando modelo Groq: {modelName})</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Al hacer clic en &quot;Iniciar Auto-Análisis&quot;, CodeAlchemist enviará su código fuente completo
            al modelo de IA configurado para obtener un resumen de posibles mejoras. También puedes descargar el código fuente completo.
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={handleStartAutoAnalysis} 
              disabled={status === "analyzing" || status === "loading_source" || !apiKey || !modelName}
              className="text-base py-3 px-6"
            >
              {(status === "analyzing" || status === "loading_source") ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              Iniciar Auto-Análisis
            </Button>
            <Button 
              onClick={handleDownloadSource} 
              disabled={isDownloading}
              variant="outline"
              className="text-base py-3 px-6"
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <DownloadCloud className="mr-2 h-5 w-5" />
              )}
              Descargar Código Fuente Completo
            </Button>
          </div>

          {analysisResult && suggestionsWithStatus.length > 0 && status === "success" && (
            <Card className="mt-6 border-accent bg-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2 text-accent-foreground">
                  <FileCode className="h-6 w-6" />
                  {analysisResult.analysisTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-accent-foreground/90 mb-1">Evaluación General:</h4>
                  <p className="text-sm text-accent-foreground/80">{analysisResult.overallAssessment}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-accent-foreground/90 mb-2">Áreas Identificadas:</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.identifiedAreas.map((area, index) => (
                      <Badge key={index} variant="secondary">{area}</Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-accent-foreground/90 mb-2">Sugerencias Detalladas:</h4>
                   <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <Info className="h-3 w-3 shrink-0"/> Las sugerencias de la IA pueden modificar archivos. Revisa cuidadosamente antes de aplicar. La aplicación es una simulación.
                    </p>
                  <ScrollArea className="h-[400px] pr-3">
                    <ul className="space-y-3">
                      {suggestionsWithStatus.map((s) => (
                        <li key={s.id} className="p-3 rounded-md border bg-background/80 shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm text-foreground">{s.area}</span>
                            {s.priority && (
                              <Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'default' : 'outline'} className="capitalize text-xs">
                                {s.priority}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{s.suggestion}</p>
                          
                          {s.status === "error_applying" && s.errorMessage && (
                             <p className="text-xs text-destructive mt-1 mb-1">Error al aplicar: {s.errorMessage}</p>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        disabled={s.status === "applying" || s.status === "applied" || !s.originalContent || !s.suggestedContent}
                                        className={s.status === "applied" ? "border-green-500 text-green-600" : ""}
                                    >
                                    {s.status === "applying" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {s.status === "applied" && <CheckCircle className="mr-2 h-4 w-4 text-green-600" />}
                                    {s.status === "error_applying" && <XCircle className="mr-2 h-4 w-4 text-destructive" />}
                                    {s.status === "pending" && <Wand2 className="mr-2 h-4 w-4" />}
                                    {s.status === "applied" ? "Aplicada (Sim.)" : s.status === "applying" ? "Aplicando..." : s.status === "error_applying" ? "Reintentar Aplicar (Sim.)" : "Aplicar Sugerencia (Sim.)"}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>¿Aplicar esta sugerencia?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Se intentará aplicar la siguiente sugerencia al archivo <strong>{s.area}</strong>:
                                        <blockquote className="mt-2 pl-3 border-l-2 italic text-xs">
                                        {s.suggestion}
                                        </blockquote>
                                        <div className="mt-3 max-h-60 overflow-y-auto text-xs space-y-1">
                                            <p className="font-semibold">Contenido Original (Fragmento):</p>
                                            <Textarea readOnly value={s.originalContent?.substring(0,500) + (s.originalContent && s.originalContent.length > 500 ? "..." : "")} rows={5} className="text-xs font-mono bg-muted/30"/>
                                             <p className="font-semibold mt-2">Contenido Sugerido (Fragmento):</p>
                                            <Textarea readOnly value={s.suggestedContent?.substring(0,500) + (s.suggestedContent && s.suggestedContent.length > 500 ? "..." : "")} rows={5} className="text-xs font-mono bg-muted/30"/>
                                        </div>
                                        <strong className="block mt-3 text-destructive">¡Importante!</strong> Esta acción (simulada) modificaría el código fuente. En un entorno real, asegúrate de tener copias de seguridad y revisar los cambios.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleApplySuggestion(s.id)}>
                                        Sí, aplicar (Simulación)
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}
           {(status === "loading_source" || status === "analyzing") && (
            <div 
              data-ai-hint="code processing animation"
              className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6"
            >
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">
                {status === "loading_source" ? "Cargando código fuente..." : "Analizando el código fuente de CodeAlchemist..."}
              </p>
              <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos.</p>
            </div>
          )}
          {status === "error" && !analysisResult && ( 
             <Card className="mt-6 border-red-500 bg-red-500/5">
               <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-6 w-6" />
                  Error en el Auto-Análisis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-700 dark:text-red-400">Ocurrió un error durante el auto-análisis. Revisa la consola para más detalles o inténtalo de nuevo.</p>
              </CardContent>
            </Card>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            <strong>Nota Importante:</strong> El análisis se realiza sobre el código fuente completo de CodeAlchemist.
            La descarga de código fuente proporciona un paquete JSON de todos los archivos detectados (excluyendo patrones de .gitignore).
            Las sugerencias de IA y su aplicación (simulada) siempre deben ser revisadas cuidadosamente por un desarrollador.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

