
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, DownloadCloud, FileCode, Wand2, CheckCircle, XCircle, Info, Edit3, Copy } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { handleAutoAnalyzeAppSource, getApplicationSourceBundle, applySuggestedChange } from './actions';
import type { AnalyzeCodeAlchemistSourceOutput, SuggestionUnit as FlowSuggestionUnit } from '@/ai/flows/analyze-codealchemist-source-flow';
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
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import JSZip from 'jszip';
import { Label } from '@/components/ui/label';
import { Progress } from "@/components/ui/progress";


type AutoUpdateStatus = "idle" | "loading_source" | "analyzing" | "success" | "error";
type SuggestionStatus = "pending" | "applying" | "applied" | "error_applying" | "not_applicable";

interface SuggestionWithStatus extends FlowSuggestionUnit {
  id: string;
  status: SuggestionStatus;
  errorMessage?: string;
  originalContent?: string; 
}

interface AnalysisProgress {
  processed: number;
  total: number;
}

export default function AutoUpdatePage() {
  const [status, setStatus] = useState<AutoUpdateStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeAlchemistSourceOutput | null>(null);
  const [currentAnalysisError, setCurrentAnalysisError] = useState<string | null>(null);
  const [suggestionsWithStatus, setSuggestionsWithStatus] = useState<SuggestionWithStatus[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [projectFiles, setProjectFiles] = useState<Awaited<ReturnType<typeof getApplicationSourceBundle>>['files']>([]);
  const [analysisPreferences, setAnalysisPreferences] = useState<string>("");
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem('codealchemist_groq_api_key'));
    setModelName(localStorage.getItem('codealchemist_groq_model_name'));
  }, []);

  const fetchProjectFiles = async () => {
     const bundleResult = await getApplicationSourceBundle(false); 
     if (bundleResult.success && bundleResult.files) {
       setProjectFiles(bundleResult.files);
     } else {
       toast({ title: "Error", description: "No se pudieron cargar los archivos del proyecto para la referencia de sugerencias.", variant: "destructive" });
       setProjectFiles([]); 
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

    setStatus("loading_source"); 
    setAnalysisResult(null);
    setCurrentAnalysisError(null);
    setSuggestionsWithStatus([]);
    setAnalysisProgress(null);
    toast({
      title: "Auto-Análisis Iniciado",
      description: "Cargando y preparando el código fuente de YskCodeAlchemist..."
    });

    await fetchProjectFiles(); 
    setStatus("analyzing"); 

    const result = await handleAutoAnalyzeAppSource(apiKey, modelName, analysisPreferences);

    if (result.success && result.data) {
      setAnalysisResult(result.data);
      const initialSuggestions = result.data.suggestions.map((s, index) => {
        // Intentar encontrar el archivo por nombre base, o por nombre de parte si fue dividido
        const relatedFile = projectFiles?.find(f => {
            if (!s.area) return false;
            const areaLower = s.area.toLowerCase();
            const fileNameLower = f.fileName.toLowerCase();
            // Check for exact match or if s.area is like "filename.ts (parte 1)"
            return fileNameLower === areaLower || fileNameLower === areaLower.split(' (parte ')[0];
        });
        let currentStatus: SuggestionStatus = "pending";
        if (!s.suggestedFullFileContent || !relatedFile?.content) { 
            currentStatus = "not_applicable";
        }

        return {
          ...s,
          id: `suggestion-${index}-${Date.now()}`,
          status: currentStatus,
          originalContent: relatedFile?.content,
        };
      });
      setSuggestionsWithStatus(initialSuggestions);
      setStatus("success");
      toast({
        title: "Auto-Análisis Completado",
        description: `Se han generado sugerencias para YskCodeAlchemist. ${result.chunksProcessed || ''} fragmentos procesados de ${result.totalChunks || ''}.`
      });
      if (result.totalChunks) {
        setAnalysisProgress({ processed: result.chunksProcessed || result.totalChunks, total: result.totalChunks });
      }
    } else {
      setStatus("error");
      setCurrentAnalysisError(result.error || "Ocurrió un error desconocido durante el auto-análisis.");
      toast({
        title: "Error en Auto-Análisis",
        description: result.error || "Ocurrió un error desconocido.",
        variant: "destructive",
        duration: 10000, // Longer duration for errors
      });
       if (result.totalChunks) {
        setAnalysisProgress({ processed: result.chunksProcessed || 0, total: result.totalChunks });
      }
    }
  };

  const handleApplySuggestion = async (suggestionId: string) => {
    const suggestionIndex = suggestionsWithStatus.findIndex(s => s.id === suggestionId);
    if (suggestionIndex === -1) return;

    const suggestionToApply = suggestionsWithStatus[suggestionIndex];
    
    if (!suggestionToApply.area) {
        toast({ title: "Error", description: `El área (nombre de archivo) no está definida para esta sugerencia.`, variant: "destructive" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying", errorMessage: "Falta el nombre del archivo en la sugerencia."} : s));
        return;
    }
    if (!suggestionToApply.originalContent) {
        toast({ title: "Error", description: `No se encontró el contenido original para ${suggestionToApply.area}. Esto puede ocurrir si el archivo es muy grande o no se pudo leer.`, variant: "destructive" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying", errorMessage: "Falta contenido original."} : s));
        return;
    }
    if (!suggestionToApply.suggestedFullFileContent) {
        toast({ title: "No Aplicable", description: `Esta sugerencia no incluye contenido de archivo modificado para aplicar directamente a ${suggestionToApply.area}. Revisa la descripción de la sugerencia.`, variant: "default" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "not_applicable", errorMessage: "No hay contenido de archivo sugerido."} : s));
        return;
    }

    setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "applying"} : s));
    toast({ title: "Aplicando Sugerencia...", description: `Simulando aplicación de cambio a ${suggestionToApply.area}` });
    
    // filePath should be the base name if it was chunked (e.g. "file.ts" from "file.ts (part 1)")
    const baseFilePath = suggestionToApply.area.includes(" (parte ") ? suggestionToApply.area.split(" (parte ")[0] : suggestionToApply.area;

    const result = await applySuggestedChange(baseFilePath, suggestionToApply.originalContent, suggestionToApply.suggestedFullFileContent);
    
    if (result.success) {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {
          ...s, 
          status: "applied", 
          // If applied, the *originalContent* for this specific suggestion unit
          // should now reflect the AI's suggested content.
          // This is for UI display if the user re-opens the dialog for this suggestion.
          // The actual `projectFiles` state will hold the aggregated true current content.
          originalContent: result.newContent, 
        } : s));
      toast({ title: "Sugerencia Aplicada (Simulación)", description: `El cambio para ${baseFilePath} se ha simulado. Revisa la consola.`});
      
      // Update the projectFiles state to reflect the simulated change
      setProjectFiles(prevFiles => (prevFiles || []).map(pf => pf.fileName === baseFilePath ? {...pf, content: result.newContent!} : pf));
    } else {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying", errorMessage: result.error} : s));
      toast({ title: "Error al Aplicar (Simulación)", description: result.error || `No se pudo simular la aplicación del cambio a ${baseFilePath}.`, variant: "destructive"});
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

  const handleDownloadSource = async () => {
    setIsDownloading(true);
    toast({
      title: "Preparando Descarga",
      description: "Recopilando todos los archivos fuente de YskCodeAlchemist..."
    });

    let filesToZip = projectFiles;
    if (!filesToZip || filesToZip.length === 0) {
        const bundleResult = await getApplicationSourceBundle(false);
        if (bundleResult.success && bundleResult.files) {
            filesToZip = bundleResult.files;
        } else {
            toast({
                title: "Error al Obtener Código Fuente",
                description: bundleResult.error || "No se pudo obtener el paquete de código fuente para la descarga.",
                variant: "destructive",
            });
            setIsDownloading(false);
            return;
        }
    }
    

    if (filesToZip && filesToZip.length > 0) {
      try {
        const zip = new JSZip();
        filesToZip.forEach(file => {
          if (file.fileName && file.fileName.trim() !== "" && !file.content.startsWith("// Archivo binario")) { 
            zip.file(file.fileName, file.content);
          } else {
            console.warn("Archivo omitido en ZIP debido a nombre inválido o contenido binario no manejable:", file);
          }
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'yskcodealchemist-full-source.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Descarga Iniciada",
          description: "El paquete completo de código fuente (yskcodealchemist-full-source.zip) se está descargando."
        });
      } catch (e) {
         const error = e instanceof Error ? e.message : "Error desconocido";
         toast({
          title: "Error al Crear Descarga ZIP",
          description: `No se pudo crear el archivo ZIP en el navegador: ${error}`,
          variant: "destructive",
        });
        console.error("Error al crear ZIP:", e);
      }
    } else {
      toast({
        title: "Error al Obtener Código Fuente",
        description: "No se encontraron archivos para empaquetar.",
        variant: "destructive",
      });
    }
    setIsDownloading(false);
  };

  useEffect(() => { 
    fetchProjectFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            AutoUpdate: Análisis de YskCodeAlchemist
          </CardTitle>
          <CardDescription className="text-lg">
            Esta sección permite a la IA analizar el propio código fuente completo de la aplicación YskCodeAlchemist para proponer mejoras y optimizaciones.
             {!apiKey || !modelName ? (
                <span className="text-destructive block mt-1"> (Clave API o Modelo no configurado en Ajustes)</span>
            ) : <span className="text-muted-foreground block mt-1">(Usando modelo Groq: {modelName})</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Al hacer clic en &quot;Iniciar Auto-Análisis&quot;, YskCodeAlchemist recopilará su código fuente, lo dividirá en fragmentos si es necesario, y lo enviará
            al modelo de IA configurado para obtener un resumen de posibles mejoras. También puedes descargar el código fuente completo.
            Las llamadas a la API tienen un tiempo de espera para evitar bloqueos indefinidos.
          </p>

          <div className="space-y-2">
            <Label htmlFor="analysis-preferences" className="text-base flex items-center gap-2">
                <Edit3 className="h-5 w-5"/> Preferencias de Análisis (Opcional)
            </Label>
            <Textarea
                id="analysis-preferences"
                value={analysisPreferences}
                onChange={(e) => setAnalysisPreferences(e.target.value)}
                placeholder="Ej: 'Enfócate en optimizar el rendimiento de los componentes React', 'Revisa la seguridad en las llamadas a API', 'Sugiere mejoras de accesibilidad'..."
                rows={3}
                className="bg-card"
            />
            <p className="text-xs text-muted-foreground">Describe qué tipo de actualizaciones o áreas específicas te gustaría que la IA priorizara.</p>
          </div>
          
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
              disabled={isDownloading || projectFiles === null || projectFiles.length === 0}
              variant="outline"
              className="text-base py-3 px-6"
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <DownloadCloud className="mr-2 h-5 w-5" />
              )}
              Descargar Código Fuente (ZIP)
            </Button>
          </div>

          {(status === "analyzing" || (status === "success" && analysisProgress) || (status === "error" && analysisProgress)) && analysisProgress && (
            <div className="mt-4 space-y-2">
                <Label className="text-sm">
                    {status === "analyzing" ? "Procesando fragmentos..." : status === "success" ? "Análisis completado." : "Análisis interrumpido."}
                </Label>
                <Progress value={(analysisProgress.processed / analysisProgress.total) * 100} className="w-full h-2" />
                <p className="text-xs text-muted-foreground">
                    {analysisProgress.processed} de {analysisProgress.total} fragmentos procesados.
                </p>
            </div>
           )}


          {analysisResult && status === "success" && (
            <Card className="mt-6 border-accent bg-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2 text-accent-foreground">
                  <FileCode className="h-6 w-6" />
                  {analysisResult.analysisTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-accent-foreground/90 mb-1">Evaluación General (Agregada):</h4>
                  <ScrollArea className="h-[100px] p-2 border rounded bg-background/50">
                    <pre className="text-xs text-accent-foreground/80 whitespace-pre-wrap">{analysisResult.overallAssessment}</pre>
                  </ScrollArea>
                </div>
                <Separator />
                {analysisResult.identifiedAreas.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-accent-foreground/90 mb-2">Áreas Identificadas (Agregado):</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.identifiedAreas.map((area, index) => (
                        <Badge key={index} variant="secondary">{area}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {suggestionsWithStatus.length > 0 && <Separator />}
                {suggestionsWithStatus.length > 0 && (
                    <div>
                    <h4 className="font-semibold text-accent-foreground/90 mb-2">Sugerencias Detalladas ({suggestionsWithStatus.length}):</h4>
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0"/> Las sugerencias de la IA pueden proponer modificar archivos. La aplicación de cambios es una SIMULACIÓN y no modificará tus archivos reales. Revisa la consola para ver qué se habría modificado.
                        </p>
                    <ScrollArea className="h-[400px] pr-3">
                        <ul className="space-y-3">
                        {suggestionsWithStatus.map((s) => (
                            <li key={s.id} className="p-3 rounded-md border bg-background/80 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-sm text-foreground break-all">{s.area || "Sugerencia General"}</span>
                                {s.priority && (
                                <Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'default' : 'outline'} className="capitalize text-xs shrink-0 ml-2">
                                    {s.priority}
                                </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{s.suggestion}</p>
                            
                            {s.status === "error_applying" && s.errorMessage && (
                                <div className="p-2 my-1 bg-destructive/10 border border-destructive/30 rounded-md">
                                    <p className="text-xs text-destructive ">Error al aplicar: {s.errorMessage}</p>
                                    <Button variant="ghost" size="sm" onClick={() => handleCopyError(s.errorMessage)} className="mt-1 h-6 px-1.5 text-xs text-destructive hover:bg-destructive/20">
                                        <Copy className="mr-1 h-3 w-3"/> Copiar Error
                                    </Button>
                                </div>
                            )}
                            {s.status === "not_applicable" && (
                                <p className="text-xs text-muted-foreground mt-1 mb-1">
                                  No aplicable directamente. {s.suggestedFullFileContent === undefined ? 'No se proporcionó contenido de archivo modificado.' : !s.originalContent ? 'Falta contenido original del archivo.' : ''}
                                </p>
                            )}

                            <div className="flex items-center gap-2 mt-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            disabled={s.status === "applying" || s.status === "applied" || s.status === "not_applicable" || !s.area || !s.originalContent || !s.suggestedFullFileContent}
                                            className={s.status === "applied" ? "border-green-500 text-green-600" : ""}
                                        >
                                        {s.status === "applying" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {s.status === "applied" && <CheckCircle className="mr-2 h-4 w-4 text-green-600" />}
                                        {s.status === "error_applying" && <XCircle className="mr-2 h-4 w-4 text-destructive" />}
                                        {s.status === "pending" && <Wand2 className="mr-2 h-4 w-4" />}
                                        {s.status === "not_applicable" && <Info className="mr-2 h-4 w-4 text-muted-foreground" />}

                                        {s.status === "applied" ? "Aplicada (Sim.)" 
                                            : s.status === "applying" ? "Aplicando..." 
                                            : s.status === "error_applying" ? "Reintentar Aplicar (Sim.)" 
                                            : s.status === "not_applicable" ? "No Aplicable"
                                            : "Aplicar Sugerencia (Sim.)"}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="max-w-3xl">
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>¿Aplicar esta sugerencia (Simulación)?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Se intentará aplicar (simuladamente) la siguiente sugerencia al archivo <strong>{s.area}</strong>:
                                            <blockquote className="mt-2 pl-3 border-l-2 italic text-xs">
                                            {s.suggestion}
                                            </blockquote>
                                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] text-xs">
                                                <div>
                                                    <p className="font-semibold mb-1">Contenido Original (Fragmento):</p>
                                                    <ScrollArea className="h-60 border rounded p-2 bg-muted/30">
                                                        <pre className="text-xs font-mono whitespace-pre-wrap">{s.originalContent?.substring(0,1500) + (s.originalContent && s.originalContent.length > 1500 ? "..." : "") || "No disponible"}</pre>
                                                    </ScrollArea>
                                                </div>
                                                <div>
                                                    <p className="font-semibold mb-1">Contenido Sugerido por IA (Fragmento):</p>
                                                    <ScrollArea className="h-60 border rounded p-2 bg-muted/30">
                                                      <pre className="text-xs font-mono whitespace-pre-wrap">{s.suggestedFullFileContent?.substring(0,1500) + (s.suggestedFullFileContent && s.suggestedFullFileContent.length > 1500 ? "..." : "") || "No disponible"}</pre>
                                                    </ScrollArea>
                                                </div>
                                            </div>
                                            <strong className="block mt-3 text-destructive">¡Importante!</strong> Esta acción es una SIMULACIÓN y NO modificará tus archivos reales. Revisa la consola del navegador y del servidor para ver los detalles de la simulación.
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
                )}
              </CardContent>
            </Card>
          )}
           {(status === "loading_source" || status === "analyzing" && !analysisProgress) && ( 
            <div 
              data-ai-hint="code processing animation"
              className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6"
            >
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">
                {status === "loading_source" ? "Cargando código fuente..." : "Analizando el código fuente de YskCodeAlchemist..."}
              </p>
              <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos, especialmente si el código es extenso.</p>
            </div>
          )}
          {status === "error" && currentAnalysisError && ( 
             <Card className="mt-6 border-destructive bg-destructive/10">
               <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive"> {/* Changed text to destructive for better contrast on destructive background */}
                  <AlertTriangle className="h-6 w-6" />
                  Error en el Auto-Análisis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-destructive-foreground">Ocurrió un error durante el auto-análisis:</p> {/* Ensure foreground has contrast */}
                <ScrollArea className="h-[100px] p-2 border border-destructive/30 rounded bg-background/50">
                    <pre className="text-xs text-foreground whitespace-pre-wrap">{currentAnalysisError}</pre> {/* Changed text to foreground (black on light themes) */}
                </ScrollArea>
                <Button variant="outline" size="sm" onClick={() => handleCopyError(currentAnalysisError)} className="mt-2 text-destructive-foreground border-destructive/50 hover:bg-destructive/20">
                    <Copy className="mr-2 h-4 w-4"/> Copiar Mensaje de Error
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            <strong>Nota Importante:</strong> El análisis se realiza sobre el código fuente completo de YskCodeAlchemist, potencialmente dividido en fragmentos para manejar límites de tokens y timeouts.
            La descarga de código fuente proporciona un archivo ZIP de todos los archivos detectados.
            Las sugerencias de IA y su aplicación (simulada) siempre deben ser revisadas cuidadosamente por un desarrollador. La capacidad de "auto-reparación" se limita a aplicar estas sugerencias simuladas.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
