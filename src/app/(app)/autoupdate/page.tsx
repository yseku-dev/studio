'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, DownloadCloud, FileCode, Wand2, CheckCircle, XCircle, Info, Edit3 } from "lucide-react";
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
import JSZip from 'jszip'; // For zipping files
import { Label } from '@/components/ui/label';


type AutoUpdateStatus = "idle" | "loading_source" | "analyzing" | "success" | "error";
type SuggestionStatus = "pending" | "applying" | "applied" | "error_applying" | "not_applicable";

interface SuggestionWithStatus extends FlowSuggestionUnit {
  id: string;
  status: SuggestionStatus;
  errorMessage?: string;
  originalContent?: string; 
  // 'suggestedFullFileContent' from FlowSuggestionUnit will be used
}


export default function AutoUpdatePage() {
  const [status, setStatus] = useState<AutoUpdateStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeAlchemistSourceOutput | null>(null);
  const [suggestionsWithStatus, setSuggestionsWithStatus] = useState<SuggestionWithStatus[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [projectFiles, setProjectFiles] = useState<Awaited<ReturnType<typeof getApplicationSourceBundle>>['files']>([]);
  const [analysisPreferences, setAnalysisPreferences] = useState<string>("");
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

    setStatus("loading_source"); 
    setAnalysisResult(null);
    setSuggestionsWithStatus([]);
    toast({
      title: "Auto-Análisis Iniciado",
      description: "Cargando y analizando el código fuente completo de CodeAlchemist..."
    });

    await fetchProjectFiles(); // Cargar archivos para referencia ANTES de que las sugerencias se procesen
    setStatus("analyzing"); 

    const result = await handleAutoAnalyzeAppSource(apiKey, modelName, analysisPreferences);

    if (result.success && result.data) {
      setAnalysisResult(result.data);
      const initialSuggestions = result.data.suggestions.map((s, index) => {
        const relatedFile = projectFiles?.find(f => s.area && f.fileName.toLowerCase().includes(s.area.toLowerCase()));
        let currentStatus: SuggestionStatus = "pending";
        if (!s.suggestedFullFileContent || !relatedFile) {
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
    
    if (!suggestionToApply.area) {
        toast({ title: "Error", description: `El área (nombre de archivo) no está definida para esta sugerencia.`, variant: "destructive" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying", errorMessage: "Falta el nombre del archivo en la sugerencia."} : s));
        return;
    }
    if (!suggestionToApply.originalContent) {
        toast({ title: "Error", description: `No se encontró el contenido original para ${suggestionToApply.area}.`, variant: "destructive" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying", errorMessage: "Falta contenido original."} : s));
        return;
    }
    if (!suggestionToApply.suggestedFullFileContent) {
        toast({ title: "No Aplicable", description: `Esta sugerencia no incluye contenido de archivo modificado para aplicar directamente a ${suggestionToApply.area}.`, variant: "default" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "not_applicable", errorMessage: "No hay contenido de archivo sugerido."} : s));
        return;
    }

    setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "applying"} : s));
    toast({ title: "Aplicando Sugerencia...", description: `Simulando aplicación de cambio a ${suggestionToApply.area}` });
    
    // La acción applySuggestedChange ahora es principalmente para simulación y logging en consola.
    // La lógica real de escritura de archivos está desactivada por seguridad.
    const result = await applySuggestedChange(suggestionToApply.area, suggestionToApply.originalContent, suggestionToApply.suggestedFullFileContent);
    
    if (result.success) {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {
          ...s, 
          status: "applied", 
          // Actualizamos el 'originalContent' localmente para reflejar el cambio simulado,
          // y el 'suggestedFullFileContent' también para consistencia.
          originalContent: result.newContent, 
          suggestedFullFileContent: result.newContent 
        } : s));
      toast({ title: "Sugerencia Aplicada (Simulación)", description: `El cambio para ${suggestionToApply.area} se ha simulado. Revisa la consola.`});
      
      // Actualizar el archivo en projectFiles localmente para futuras referencias si se aplicara realmente
      setProjectFiles(prevFiles => (prevFiles || []).map(pf => pf.fileName === suggestionToApply.area ? {...pf, content: result.newContent!} : pf));
    } else {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying", errorMessage: result.error} : s));
      toast({ title: "Error al Aplicar (Simulación)", description: result.error || `No se pudo simular la aplicación del cambio a ${suggestionToApply.area}.`, variant: "destructive"});
    }
  };

  const handleDownloadSource = async () => {
    setIsDownloading(true);
    toast({
      title: "Preparando Descarga",
      description: "Recopilando todos los archivos fuente de CodeAlchemist..."
    });

    const result = await getApplicationSourceBundle(false); // No concatenar para descarga

    if (result.success && result.files) {
      try {
        const zip = new JSZip();
        result.files.forEach(file => {
          // Asegurarse de que no haya nombres de archivo vacíos o inválidos
          if (file.fileName && file.fileName.trim() !== "") {
            zip.file(file.fileName, file.content);
          } else {
            console.warn("Archivo omitido en ZIP debido a nombre inválido:", file);
          }
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'codealchemist-full-source.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Descarga Iniciada",
          description: "El paquete completo de código fuente (codealchemist-full-source.zip) se está descargando."
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
              disabled={isDownloading}
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
                  <h4 className="font-semibold text-accent-foreground/90 mb-1">Evaluación General:</h4>
                  <p className="text-sm text-accent-foreground/80">{analysisResult.overallAssessment}</p>
                </div>
                <Separator />
                {analysisResult.identifiedAreas.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-accent-foreground/90 mb-2">Áreas Identificadas:</h4>
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
                    <h4 className="font-semibold text-accent-foreground/90 mb-2">Sugerencias Detalladas:</h4>
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
                                <p className="text-xs text-destructive mt-1 mb-1">Error al aplicar: {s.errorMessage}</p>
                            )}
                            {s.status === "not_applicable" && (
                                <p className="text-xs text-muted-foreground mt-1 mb-1">No aplicable directamente (sin contenido de archivo sugerido).</p>
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
                                                        <pre className="text-xs font-mono whitespace-pre-wrap">{s.originalContent?.substring(0,1500) + (s.originalContent && s.originalContent.length > 1500 ? "..." : "")}</pre>
                                                    </ScrollArea>
                                                </div>
                                                <div>
                                                    <p className="font-semibold mb-1">Contenido Sugerido por IA (Fragmento):</p>
                                                    <ScrollArea className="h-60 border rounded p-2 bg-muted/30">
                                                      <pre className="text-xs font-mono whitespace-pre-wrap">{s.suggestedFullFileContent?.substring(0,1500) + (s.suggestedFullFileContent && s.suggestedFullFileContent.length > 1500 ? "..." : "")}</pre>
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
           {(status === "loading_source" || status === "analyzing") && (
            <div 
              data-ai-hint="code processing animation"
              className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6"
            >
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">
                {status === "loading_source" ? "Cargando código fuente..." : "Analizando el código fuente de CodeAlchemist..."}
              </p>
              <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos, especialmente si el código es extenso.</p>
            </div>
          )}
          {status === "error" && !analysisResult && ( 
             <Card className="mt-6 border-destructive bg-destructive/10">
               <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive-foreground">
                  <AlertTriangle className="h-6 w-6" />
                  Error en el Auto-Análisis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-destructive-foreground">Ocurrió un error durante el auto-análisis. Revisa la consola para más detalles o inténtalo de nuevo.</p>
              </CardContent>
            </Card>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            <strong>Nota Importante:</strong> El análisis se realiza sobre el código fuente completo de CodeAlchemist.
            La descarga de código fuente proporciona un archivo ZIP de todos los archivos detectados (excluyendo patrones de .gitignore).
            Las sugerencias de IA y su aplicación (simulada) siempre deben ser revisadas cuidadosamente por un desarrollador.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
