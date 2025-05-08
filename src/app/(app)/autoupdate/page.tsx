
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, DownloadCloud, FileCode, Wand2, CheckCircle, XCircle, Info, Edit3, Copy, Settings2, ListOrdered, ShieldAlert, GitFork, Trash2, Expand, Minimize } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { handleAutoAnalyzeAppSource, getApplicationSourceBundle, applySuggestedChange, handleGetErrorFixSuggestion, handleUploadToGit } from './actions';
import type { AnalyzeCodeAlchemistSourceOutput, SuggestionUnit as FlowSuggestionUnit } from '@/ai/flows/analyze-codealchemist-source-flow';
import type { SuggestErrorFixOutput } from '@/ai/flows/suggest-error-fix-flow';
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
import { cn } from '@/lib/utils';


type AutoUpdateStatus = "idle" | "loading_source" | "analyzing" | "success" | "error" | "fixing_error" | "uploading_git" | "fixing_git_error";
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

interface GitConfig {
  repoUrl: string | null;
  username: string | null;
  email: string | null;
  pat: string | null;
}

export default function AutoUpdatePage() {
  const [status, setStatus] = useState<AutoUpdateStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeAlchemistSourceOutput | null>(null);
  const [currentAnalysisError, setCurrentAnalysisError] = useState<string | null>(null);
  const [suggestionsWithStatus, setSuggestionsWithStatus] = useState<SuggestionWithStatus[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [projectFiles, setProjectFiles] = useState<Awaited<ReturnType<typeof getApplicationSourceBundle>>['files']>([]);
  const [analysisPreferences, setAnalysisPreferences] = useState<string>("");
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({ processed: 0, total: 0 });
  const [autoFixSuggestion, setAutoFixSuggestion] = useState<SuggestErrorFixOutput | null>(null);
  const [isAutoFixModalOpen, setIsAutoFixModalOpen] = useState(false);
  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const { toast } = useToast();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [gitConfig, setGitConfig] = useState<GitConfig>({ repoUrl: null, username: null, email: null, pat: null });

  const [gitUploadRetryCount, setGitUploadRetryCount] = useState(0);
  const MAX_GIT_UPLOAD_RETRIES = 5;


  useEffect(() => {
    setApiKey(localStorage.getItem('codealchemist_groq_api_key'));
    setModelName(localStorage.getItem('codealchemist_groq_model_name'));
    setGitConfig({
        repoUrl: localStorage.getItem('codealchemist_git_repository_url'),
        username: localStorage.getItem('codealchemist_git_username'),
        email: localStorage.getItem('codealchemist_git_email'),
        pat: localStorage.getItem('codealchemist_git_pat'),
    });
  }, []);

  const fetchProjectFiles = async (targetLogs?: string[]) => {
     const bundleResult = await getApplicationSourceBundle(false, targetLogs); 
     if (bundleResult.success && bundleResult.files) {
       setProjectFiles(bundleResult.files);
       if (targetLogs) targetLogs.push(`[CLIENT] Archivos del proyecto cargados en el estado local: ${bundleResult.files.length} archivos.`);
     } else {
       toast({ title: "Error", description: "No se pudieron cargar los archivos del proyecto para la referencia de sugerencias.", variant: "destructive" });
       setProjectFiles([]); 
       if (targetLogs) targetLogs.push(`[CLIENT ERROR] No se pudieron cargar los archivos del proyecto. Error: ${bundleResult.error}`);
     }
  };

  const handleStartAutoAnalysis = async (isRetry: boolean = false) => {
    if (!apiKey || !modelName) {
      toast({
        title: 'Configuración Faltante',
        description: 'Por favor, establece tu Clave API de Groq y Nombre de Modelo en Configuración.',
        variant: 'destructive',
      });
      return;
    }

    const initialLogs = isRetry ? [...detailedLogs] : []; // Start fresh logs if not a retry, else append
    initialLogs.push(`[CLIENT ${new Date().toISOString()}] ${isRetry ? 'Reintentando' : 'Iniciando'} auto-análisis...`);
    setStatus("loading_source"); 
    setAnalysisResult(null);
    setCurrentAnalysisError(null); // Clear previous analysis error
    setCurrentGitError(null); // Clear previous git error
    setSuggestionsWithStatus([]);
    setAnalysisProgress({ processed: 0, total: 0 }); 
    setAutoFixSuggestion(null);
    setDetailedLogs(initialLogs);

    toast({
      title: isRetry ? "Reintentando Auto-Análisis" : "Auto-Análisis Iniciado",
      description: "Cargando y preparando el código fuente de CodeAlchemist..."
    });

    await fetchProjectFiles(initialLogs); 
    initialLogs.push(`[CLIENT ${new Date().toISOString()}] Estado cambiado a 'analyzing'. Llamando a handleAutoAnalyzeAppSource.`);
    setStatus("analyzing"); 

    const result = await handleAutoAnalyzeAppSource(apiKey, modelName, analysisPreferences);
    
    setDetailedLogs(prevLogs => [...prevLogs, ...(result.detailedExecutionLogs || [`[CLIENT ${new Date().toISOString()}] Llamada a handleAutoAnalyzeAppSource completada.`])]);

    setAnalysisProgress({ 
        processed: result.chunksProcessed || 0, 
        total: result.totalChunks || 0 
    });

    if (result.success && result.data) {
      setAnalysisResult(result.data);
      const initialSuggestions = result.data.suggestions.map((s, index) => {
        const relatedFile = projectFiles?.find(f => {
            if (!s.area) return false;
            const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
            const areaLower = normalizePath(s.area.toLowerCase());
            const fileNameLower = normalizePath(f.fileName.toLowerCase());
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
        description: `Se han generado sugerencias para CodeAlchemist. ${result.chunksProcessed || 0} de ${result.totalChunks || 0} fragmentos procesados.`
      });
      setDetailedLogs(prevLogs => [...prevLogs, `[CLIENT ${new Date().toISOString()}] Análisis completado y resultados procesados en UI.`]);
    } else {
      setStatus("error");
      setCurrentAnalysisError(result.error || "Ocurrió un error desconocido durante el auto-análisis.");
      setCurrentGitError(null); // Clear git error if analysis fails
      toast({
        title: "Error en Auto-Análisis",
        description: result.error || "Ocurrió un error desconocido.",
        variant: "destructive",
        duration: 10000, 
      });
       setDetailedLogs(prevLogs => [...prevLogs, `[CLIENT ERROR ${new Date().toISOString()}] Error en auto-análisis: ${result.error || "Desconocido"}`]);
    }
  };
  
  const handleAttemptAutoFix = async (errorToFix?: string | null, errorContext?: string) => {
    const targetError = errorToFix || currentAnalysisError || currentGitError;
    if (!targetError || !apiKey || !modelName) {
      toast({
        title: "Información Faltante",
        description: "No hay error actual para corregir o falta configuración de API.",
        variant: "destructive"
      });
      return;
    }
    const newLogs = [...detailedLogs];
    newLogs.push(`[CLIENT ${new Date().toISOString()}] Intentando auto-corrección para el error: ${targetError.substring(0, 100)}...`);
    const prevStatus = status;
    
    let fixingStatus: AutoUpdateStatus = "fixing_error";
    if (errorContext?.toLowerCase().includes("git") || currentGitError) {
        fixingStatus = "fixing_git_error";
    }
    setStatus(fixingStatus);
    setAutoFixSuggestion(null);
    setDetailedLogs(newLogs);
    toast({ title: "Intentando Auto-Corrección", description: "Consultando a la IA para una posible solución..." });

    const fixResult = await handleGetErrorFixSuggestion(targetError, apiKey, modelName, newLogs, errorContext);
    setDetailedLogs(newLogs);

    if (fixResult.success && fixResult.data) {
      setAutoFixSuggestion(fixResult.data);
      setIsAutoFixModalOpen(true); 
      toast({ title: "Sugerencia de Corrección Recibida", description: "La IA ha proporcionado una sugerencia." });
      newLogs.push(`[CLIENT ${new Date().toISOString()}] Sugerencia de corrección recibida de la IA.`);
    } else {
      toast({
        title: "Error en Auto-Corrección",
        description: fixResult.error || "No se pudo obtener una sugerencia de la IA.",
        variant: "destructive"
      });
      newLogs.push(`[CLIENT ERROR ${new Date().toISOString()}] Error al obtener sugerencia de corrección: ${fixResult.error || "Desconocido"}`);
    }
    // Revert to previous error state or success if analysis was successful before fix attempt
    setStatus(prevStatus === "fixing_error" || prevStatus === "fixing_git_error" ? (currentGitError || currentAnalysisError ? "error" : (analysisResult ? "success" : "idle")) : prevStatus ); 
    setDetailedLogs(newLogs);
  };


  const handleApplySuggestion = async (suggestionId: string) => {
    const currentLogsCopy = [...detailedLogs];
    const suggestionIndex = suggestionsWithStatus.findIndex(s => s.id === suggestionId);
    if (suggestionIndex === -1) {
        currentLogsCopy.push(`[CLIENT ERROR ${new Date().toISOString()}] No se encontró la sugerencia con ID: ${suggestionId}`);
        setDetailedLogs(currentLogsCopy);
        return;
    }

    const suggestionToApply = suggestionsWithStatus[suggestionIndex];
    
    currentLogsCopy.push(`[CLIENT ${new Date().toISOString()}] Iniciando aplicación de sugerencia a: ${suggestionToApply.area || 'área desconocida'}`);

    if (!suggestionToApply.area) {
        toast({ title: "Error de Aplicación", description: `El área (nombre de archivo) no está definida para esta sugerencia.`, variant: "destructive" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying", errorMessage: "Falta el nombre del archivo en la sugerencia."} : s));
        currentLogsCopy.push(`[CLIENT ERROR ${new Date().toISOString()}] Falta nombre de archivo para sugerencia ID: ${suggestionId}`);
        setDetailedLogs(currentLogsCopy);
        return;
    }
    if (!suggestionToApply.originalContent) {
        toast({ title: "Error de Aplicación", description: `No se encontró el contenido original para ${suggestionToApply.area}. Esto puede ocurrir si el archivo es muy grande o no se pudo leer.`, variant: "destructive" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying", errorMessage: "Falta contenido original del archivo."} : s));
        currentLogsCopy.push(`[CLIENT ERROR ${new Date().toISOString()}] Falta contenido original para ${suggestionToApply.area} (ID: ${suggestionId})`);
        setDetailedLogs(currentLogsCopy);
        return;
    }
    if (!suggestionToApply.suggestedFullFileContent) {
        toast({ title: "No Aplicable Directamente", description: `Esta sugerencia no incluye contenido de archivo modificado para aplicar directamente a ${suggestionToApply.area}. Revisa la descripción de la sugerencia.`, variant: "default" });
        setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "not_applicable", errorMessage: "No hay contenido de archivo sugerido."} : s));
        currentLogsCopy.push(`[CLIENT INFO ${new Date().toISOString()}] Sugerencia ID ${suggestionId} para ${suggestionToApply.area} no es aplicable directamente (sin contenido sugerido).`);
        setDetailedLogs(currentLogsCopy);
        return;
    }

    setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "applying"} : s));
    toast({ title: "Aplicando Sugerencia...", description: `Aplicando cambio a ${suggestionToApply.area}` });
    currentLogsCopy.push(`[CLIENT ${new Date().toISOString()}] Estado: 'applying'. Llamando a applySuggestedChange para ${suggestionToApply.area}.`);
    
    const baseFilePath = suggestionToApply.area.includes(" (parte ") ? suggestionToApply.area.split(" (parte ")[0] : suggestionToApply.area;

    const result = await applySuggestedChange(baseFilePath, suggestionToApply.originalContent, suggestionToApply.suggestedFullFileContent, currentLogsCopy);
    
    if (result.success && result.newContent !== undefined) {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {
          ...s, 
          status: "applied", 
          originalContent: result.newContent, 
        } : s));
      toast({ title: "Sugerencia Aplicada", description: `El cambio para ${baseFilePath} se ha aplicado. Revisa la consola y los logs.`});
      currentLogsCopy.push(`[CLIENT SUCCESS ${new Date().toISOString()}] Sugerencia aplicada a ${baseFilePath}. El contenido del archivo ha sido actualizado.`);
      
      setProjectFiles(prevFiles => (prevFiles || []).map(pf => {
        const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
        if (normalizePath(pf.fileName.toLowerCase()) === normalizePath(baseFilePath.toLowerCase())) {
          currentLogsCopy.push(`[CLIENT DETAIL ${new Date().toISOString()}] Actualizando contenido en projectFiles para ${pf.fileName}.`);
          return {...pf, content: result.newContent! };
        }
        return pf;
      }));

    } else {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? {...s, status: "error_applying", errorMessage: result.error} : s));
      toast({ title: "Error al Aplicar", description: result.error || `No se pudo aplicar el cambio a ${baseFilePath}.`, variant: "destructive"});
      currentLogsCopy.push(`[CLIENT ERROR ${new Date().toISOString()}] Error al aplicar sugerencia a ${baseFilePath}: ${result.error}`);
    }
    setDetailedLogs(currentLogsCopy);
  };

  const handleCopyLogsToClipboard = (logContent: string[] | string | undefined) => {
    if (!logContent) return;
    const textToCopy = Array.isArray(logContent) ? logContent.join('\n') : logContent;
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast({ title: 'Copiado', description: 'El contenido ha sido copiado al portapapeles.' });
      })
      .catch(err => {
        console.error('Error al copiar:', err);
        toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar el contenido.', variant: 'destructive' });
      });
  };

  const handleClearLogs = () => {
    setDetailedLogs(["[CLIENT INFO] Logs borrados por el usuario."]);
    toast({title: "Logs Borrados", description: "Los logs de ejecución detallados han sido borrados."});
  };

  const handleToggleLogsExpansion = () => {
    setLogsExpanded(prev => !prev);
  }

  const handleDownloadSource = async () => {
    setIsDownloading(true);
    const currentLogsCopy = [...detailedLogs];
    currentLogsCopy.push(`[CLIENT ${new Date().toISOString()}] Iniciando preparación para descarga de código fuente.`);
    toast({
      title: "Preparando Descarga",
      description: "Recopilando todos los archivos fuente de CodeAlchemist..."
    });

    let filesToZip = projectFiles;
    if (!filesToZip || filesToZip.length === 0) {
        currentLogsCopy.push(`[CLIENT WARN ${new Date().toISOString()}] projectFiles está vacío o nulo, intentando obtener de nuevo.`);
        const bundleResult = await getApplicationSourceBundle(false, currentLogsCopy); 
        if (bundleResult.success && bundleResult.files) {
            filesToZip = bundleResult.files;
            setProjectFiles(filesToZip);
        } else {
            toast({
                title: "Error al Obtener Código Fuente",
                description: bundleResult.error || "No se pudo obtener el paquete de código fuente para la descarga.",
                variant: "destructive",
            });
            setIsDownloading(false);
            currentLogsCopy.push(`[CLIENT ERROR ${new Date().toISOString()}] Error al obtener código fuente para ZIP: ${bundleResult.error || "Desconocido"}`);
            setDetailedLogs(currentLogsCopy);
            return;
        }
    }
    
    currentLogsCopy.push(`[CLIENT ${new Date().toISOString()}] Se empaquetarán ${filesToZip?.length || 0} archivos.`);

    if (filesToZip && filesToZip.length > 0) {
      try {
        const zip = new JSZip();
        filesToZip.forEach(file => {
          if (file.fileName && file.fileName.trim() !== "" && !file.content.startsWith("// Archivo binario") && !file.content.startsWith("// Error:")) { 
            zip.file(file.fileName, file.content);
            currentLogsCopy.push(`[CLIENT DETAIL ${new Date().toISOString()}] Añadido al ZIP: ${file.fileName} (${file.content.length} bytes)`);
          } else {
            console.warn("Archivo omitido en ZIP debido a nombre inválido, contenido binario no manejable o error:", file.fileName);
            currentLogsCopy.push(`[CLIENT WARN ${new Date().toISOString()}] Omitido en ZIP: ${file.fileName} (razón: ${file.content.startsWith("// Archivo binario") ? "binario" : file.content.startsWith("// Error:") ? "error previo" : "nombre inválido"})`);
          }
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'codealchemist-source.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Descarga Iniciada",
          description: "El paquete de código fuente (codealchemist-source.zip) se está descargando."
        });
        currentLogsCopy.push(`[CLIENT ${new Date().toISOString()}] Descarga ZIP iniciada (codealchemist-source.zip).`);
      } catch (e) {
         const error = e instanceof Error ? e.message : "Error desconocido";
         toast({
          title: "Error al Crear Descarga ZIP",
          description: `No se pudo crear el archivo ZIP en el navegador: ${error}`,
          variant: "destructive",
        });
        console.error("Error al crear ZIP:", e);
        currentLogsCopy.push(`[CLIENT ERROR ${new Date().toISOString()}] Error al crear ZIP: ${error}`);
      }
    } else {
      toast({
        title: "Error al Obtener Código Fuente",
        description: "No se encontraron archivos para empaquetar.",
        variant: "destructive",
      });
      currentLogsCopy.push(`[CLIENT ERROR ${new Date().toISOString()}] Error: No se encontraron archivos para empaquetar en ZIP.`);
    }
    setDetailedLogs(currentLogsCopy);
    setIsDownloading(false);
  };

  const [currentGitError, setCurrentGitError] = useState<string | null>(null);

  const performGitUpload = async (isRetry: boolean = false) => {
    const { repoUrl, username, email, pat } = gitConfig;
    if (!repoUrl || !username || !email || !pat) {
        toast({
            title: "Configuración de Git Incompleta",
            description: "Por favor, completa la configuración de Git en Ajustes (URL, Usuario, Email y PAT).",
            variant: "destructive",
        });
        setStatus("error"); // Or back to previous relevant status
        return;
    }

    setCurrentGitError(null); // Clear previous Git error
    setCurrentAnalysisError(null); // Clear previous analysis error
    setStatus("uploading_git");
    const currentLogsCopy = [...detailedLogs];

    const attemptNumber = isRetry ? gitUploadRetryCount : 1;
    const commitMsg = `CodeAlchemist: AutoUpdate Sync (Attempt ${attemptNumber})`;
    
    currentLogsCopy.push(`[CLIENT ${new Date().toISOString()}] ${isRetry ? `Retrying (${attemptNumber}/${MAX_GIT_UPLOAD_RETRIES})` : 'Initiating'} Git upload to: ${repoUrl.replace(pat, '********')}`);
    setDetailedLogs(currentLogsCopy);
    toast({ title: `${isRetry ? `Retrying Git Upload (Attempt ${attemptNumber})` : "Subiendo a Git..."}` , description: `Intentando subir el código fuente a ${repoUrl.split('/').pop()?.replace('.git',' ')}`});

    const result = await handleUploadToGit({ repoUrl, username, email, pat }, commitMsg, currentLogsCopy);
    
    setDetailedLogs(currentLogsCopy); 

    if (result.success) {
        toast({
            title: "Subida a Git Exitosa",
            description: result.message,
            duration: 7000,
        });
        setGitUploadRetryCount(0); // Reset on success
        setStatus(analysisResult ? "success" : "idle");
    } else {
        setCurrentGitError(result.message);
        toast({
            title: `Error en Subida a Git${isRetry ? ` (Intento ${attemptNumber})` : ''}`,
            description: result.message,
            variant: "destructive",
            duration: 10000,
             action: (gitUploadRetryCount < MAX_GIT_UPLOAD_RETRIES || !isRetry) ? ( // Show Auto-Fix only if retries are left or it's the first attempt
                <Button 
                    variant="outline" 
                    size="sm"
                    className="ml-auto border-destructive/50 text-destructive hover:bg-destructive/20 hover:text-destructive-foreground"
                    onClick={() => handleAttemptAutoFix(result.message, "Error ocurrido durante la subida del código fuente a un repositorio Git.")}
                >
                    <Settings2 className="mr-2 h-4 w-4"/> Auto-Fix
                </Button>
            ) : undefined
        });
        setStatus("error"); 
    }
  };

  const handleInitialGitUpload = () => {
    setGitUploadRetryCount(1); // Set to 1 for the first attempt
    performGitUpload(false);
  };

  const handleRetryGitUploadFromModal = () => {
    if (gitUploadRetryCount >= MAX_GIT_UPLOAD_RETRIES) {
        toast({ title: "Máximo de Reintentos Alcanzado", description: `No se pueden realizar más de ${MAX_GIT_UPLOAD_RETRIES} intentos para la subida a Git.`, variant: "destructive" });
        setIsAutoFixModalOpen(false);
        return;
    }
    setIsAutoFixModalOpen(false);
    setGitUploadRetryCount(prev => prev + 1);
    performGitUpload(true);
  };


  useEffect(() => { 
    const initialLogs: string[] = [];
    initialLogs.push(`[CLIENT ${new Date().toISOString()}] AutoUpdatePage montado. Cargando archivos de proyecto iniciales...`);
    fetchProjectFiles(initialLogs).finally(() => {
        initialLogs.push(`[CLIENT ${new Date().toISOString()}] Carga inicial de archivos de proyecto completada.`);
        setDetailedLogs(initialLogs); 
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const isGitConfigured = gitConfig.repoUrl && gitConfig.username && gitConfig.email && gitConfig.pat;
  const isProcessing = status === "analyzing" || status === "loading_source" || status === "fixing_error" || status === "uploading_git" || status === "fixing_git_error";


  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            AutoUpdate: Análisis de CodeAlchemist
          </CardTitle>
          <CardDescription className="text-lg text-foreground">
            Esta sección permite a la IA analizar el propio código fuente completo de la aplicación CodeAlchemist para proponer mejoras y optimizaciones.
             {!apiKey || !modelName ? (
                <span className="text-destructive block mt-1"> (Clave API o Modelo no configurado en Ajustes)</span>
            ) : <span className="text-foreground block mt-1">(Usando modelo Groq: {modelName})</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Al hacer clic en &quot;Iniciar Auto-Análisis&quot;, CodeAlchemist recopilará su código fuente, lo dividirá en fragmentos si es necesario, y lo enviará
            al modelo de IA configurado para obtener un resumen de posibles mejoras. También puedes descargar el código fuente completo o subirlo a un repositorio Git si está configurado.
            Las llamadas a la API tienen un tiempo de espera para evitar bloqueos indefinidos.
          </p>

          <div className="space-y-2">
            <Label htmlFor="analysis-preferences" className="text-base flex items-center gap-2 text-foreground">
                <Edit3 className="h-5 w-5"/> Preferencias de Análisis (Opcional)
            </Label>
            <Textarea
                id="analysis-preferences"
                value={analysisPreferences}
                onChange={(e) => setAnalysisPreferences(e.target.value)}
                placeholder="Ej: 'Enfócate en optimizar el rendimiento de los componentes React', 'Revisa la seguridad en las llamadas a API', 'Sugiere mejoras de accesibilidad'..."
                rows={3}
                className="bg-card text-foreground"
            />
            <p className="text-xs text-muted-foreground">Describe qué tipo de actualizaciones o áreas específicas te gustaría que la IA priorizara.</p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={() => handleStartAutoAnalysis(false)} 
              disabled={isProcessing || !apiKey || !modelName}
              className="text-base py-3 px-6"
            >
              {status === "analyzing" || status === "loading_source" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              Iniciar Auto-Análisis
            </Button>
            <Button 
              onClick={handleDownloadSource} 
              disabled={isDownloading || projectFiles === null || projectFiles.length === 0 || isProcessing}
              variant="outline"
              className="text-base py-3 px-6 text-foreground"
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <DownloadCloud className="mr-2 h-5 w-5" />
              )}
              Descargar Código Fuente (ZIP)
            </Button>
             <Button 
              onClick={handleInitialGitUpload} 
              disabled={!isGitConfigured || projectFiles === null || projectFiles.length === 0 || isProcessing}
              variant="outline"
              className="text-base py-3 px-6 text-foreground"
              title={!isGitConfigured ? "Configura los detalles de Git en Ajustes para habilitar esta opción." : "Subir código fuente a Git"}
            >
              {status === "uploading_git" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <GitFork className="mr-2 h-5 w-5" />
              )}
              Subir a Git
            </Button>
          </div>

          {(status === "analyzing" || status === "success" || status === "error" || status === "uploading_git" || status === "fixing_error" || status === "fixing_git_error" || status === "loading_source") && (
            <div className="mt-4 space-y-2">
                <Label className="text-sm text-foreground">
                    {status === "loading_source" ? "Cargando código fuente..." :
                     status === "analyzing" ? 
                        (analysisProgress.total > 0 ? `Procesando fragmentos... (${analysisProgress.processed}/${analysisProgress.total})` : "Iniciando análisis, calculando total de fragmentos...") : 
                     status === "success" ? `Análisis completado (${analysisProgress.processed}/${analysisProgress.total} fragmentos).` : 
                     status === "error" && currentAnalysisError ? `Análisis interrumpido (${analysisProgress.processed > 0 ? `${analysisProgress.processed}/` : ''}${analysisProgress.total > 0 ? analysisProgress.total : 'desconocido'} fragmentos).` :
                     status === "error" && currentGitError ? "Error durante operación Git." :
                     status === "uploading_git" ? `Subiendo a Git (Intento ${gitUploadRetryCount}/${MAX_GIT_UPLOAD_RETRIES})...` :
                     status === "fixing_error" ? "Intentando auto-corrección de error de análisis..." :
                     status === "fixing_git_error" ? "Intentando auto-corrección de error de Git..." : ""}
                </Label>
                <Progress 
                    value={
                        status === "loading_source" ? 5 : // Small progress for loading
                        status === "analyzing" && analysisProgress.total === 0 ? 10 : // Small progress for initial analysis phase
                        analysisProgress.total > 0 ? (analysisProgress.processed / analysisProgress.total) * 100 : 
                        (status === "success" || status === "error" || status === "uploading_git" || status === "fixing_error" || status === "fixing_git_error" ? 100 : 0) 
                    } 
                    className="w-full h-3" 
                />
                {(analysisProgress.total > 0 || (status === "error" && analysisProgress.processed > 0 && currentAnalysisError)) && (
                    <p className="text-xs text-muted-foreground">
                        {analysisProgress.processed} de {analysisProgress.total > 0 ? analysisProgress.total : (analysisProgress.processed > 0 ? analysisProgress.processed : '?')} fragmentos procesados.
                    </p>
                )}
            </div>
           )}

           {detailedLogs.length > 0 && (
             <Card className="mt-6 border-primary/30">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <ListOrdered className="h-5 w-5"/> Logs de Ejecución Detallados
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={handleToggleLogsExpansion} title={logsExpanded ? "Contraer Logs" : "Expandir Logs"}>
                            {logsExpanded ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                        </Button>
                         <Button variant="ghost" size="icon" onClick={handleClearLogs} title="Borrar Logs">
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </CardHeader>
               <CardContent>
                 <ScrollArea className={cn("p-2 border rounded bg-muted/30 transition-all duration-300 ease-in-out", logsExpanded ? "h-[500px]" : "h-[250px]")}>
                   <pre className="text-xs text-foreground whitespace-pre-wrap">
                     {detailedLogs.map((log, index) => (
                        <span key={index} className={log.includes("[ERROR") ? "text-destructive" : log.includes("[WARN") ? "text-yellow-600 dark:text-yellow-400" : ""}>
                            {log}\n
                        </span>
                     ))}
                   </pre>
                 </ScrollArea>
                  <Button variant="outline" size="sm" onClick={() => handleCopyLogsToClipboard(detailedLogs)} className="mt-2 text-foreground">
                    <Copy className="mr-2 h-4 w-4"/> Copiar Logs
                  </Button>
               </CardContent>
             </Card>
           )}


          {analysisResult && status === "success" && (
            <Card className="mt-6 border-accent bg-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2 text-accent">
                  <FileCode className="h-6 w-6" />
                  {analysisResult.analysisTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Evaluación General (Agregada):</h4>
                  <ScrollArea className="h-[100px] p-2 border rounded bg-background/50">
                    <pre className="text-xs text-foreground/80 whitespace-pre-wrap">{analysisResult.overallAssessment}</pre>
                  </ScrollArea>
                </div>
                <Separator />
                {analysisResult.identifiedAreas.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Áreas Identificadas (Agregado):</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.identifiedAreas.map((area, index) => (
                        <Badge key={index} variant="secondary" className="text-foreground">{area}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {suggestionsWithStatus.length > 0 && <Separator />}
                {suggestionsWithStatus.length > 0 && (
                    <div>
                    <h4 className="font-semibold text-foreground mb-2">Sugerencias Detalladas ({suggestionsWithStatus.length}):</h4>
                    <div className="p-3 my-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-md flex items-start gap-2">
                        <ShieldAlert className="h-5 w-5 text-yellow-700 dark:text-yellow-300 shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        <strong>¡Atención!</strong> Aplicar estas sugerencias modificará directamente los archivos del código fuente de esta aplicación. 
                        Asegúrate de entender los cambios y de tener una copia de seguridad si es necesario. Los cambios incorrectos podrían afectar la funcionalidad de la aplicación.
                        </p>
                    </div>
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
                                    <Button variant="ghost" size="sm" onClick={() => handleCopyLogsToClipboard(s.errorMessage)} className="mt-1 h-6 px-1.5 text-xs text-destructive hover:bg-destructive/20">
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
                                            className={cn(s.status === "applied" ? "border-green-500 text-green-700 dark:text-green-400 hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/50" : 
                                                       s.status === "error_applying" ? "border-destructive text-destructive hover:border-destructive hover:bg-destructive/10" :
                                                       "text-foreground")}
                                        >
                                        {s.status === "applying" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {s.status === "applied" && <CheckCircle className="mr-2 h-4 w-4 text-green-600 dark:text-green-500" />}
                                        {s.status === "error_applying" && <XCircle className="mr-2 h-4 w-4 text-destructive" />}
                                        {s.status === "pending" && <Wand2 className="mr-2 h-4 w-4" />}
                                        {s.status === "not_applicable" && <Info className="mr-2 h-4 w-4 text-muted-foreground" />}

                                        {s.status === "applied" ? "Aplicada" 
                                            : s.status === "applying" ? "Aplicando..." 
                                            : s.status === "error_applying" ? "Reintentar Aplicar" 
                                            : s.status === "not_applicable" ? "No Aplicable"
                                            : "Aplicar Sugerencia"}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="max-w-3xl">
                                        <AlertDialogHeader>
                                        <AlertDialogTitle className="text-foreground flex items-center gap-2"><ShieldAlert className="text-destructive h-6 w-6"/>¿Aplicar esta sugerencia?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-muted-foreground">
                                            Se intentará aplicar la siguiente sugerencia al archivo <strong className="text-foreground">{s.area}</strong>:
                                            <blockquote className="mt-2 pl-3 border-l-2 italic text-xs text-muted-foreground">
                                            {s.suggestion}
                                            </blockquote>
                                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] text-xs">
                                                <div>
                                                    <p className="font-semibold mb-1 text-foreground">Contenido Original (Fragmento):</p>
                                                    <ScrollArea className="h-60 border rounded p-2 bg-muted/30">
                                                        <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{s.originalContent?.substring(0,1500) + (s.originalContent && s.originalContent.length > 1500 ? "..." : "") || "No disponible"}</pre>
                                                    </ScrollArea>
                                                </div>
                                                <div>
                                                    <p className="font-semibold mb-1 text-foreground">Contenido Sugerido por IA (Fragmento):</p>
                                                    <ScrollArea className="h-60 border rounded p-2 bg-muted/30">
                                                      <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{s.suggestedFullFileContent?.substring(0,1500) + (s.suggestedFullFileContent && s.suggestedFullFileContent.length > 1500 ? "..." : "") || "No disponible"}</pre>
                                                    </ScrollArea>
                                                </div>
                                            </div>
                                            <strong className="block mt-3 text-destructive">¡Importante!</strong> Esta acción modificará el archivo en el sistema. Asegúrate de que es lo que deseas.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleApplySuggestion(s.id)} className="bg-destructive hover:bg-destructive/90">
                                            Sí, aplicar cambio
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
           {(status === "loading_source" || (status === "analyzing" && (!analysisProgress || analysisProgress.total === 0))) && ( 
            <div 
              data-ai-hint="code processing animation"
              className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6"
            >
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-foreground">
                {status === "loading_source" ? "Cargando código fuente..." : "Preparando análisis del código fuente de CodeAlchemist..."}
              </p>
              <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos, especialmente si el código es extenso.</p>
            </div>
          )}
          {status === "error" && (currentAnalysisError || currentGitError) && ( 
             <Card className="mt-6 border-destructive bg-destructive/10">
               <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive"> 
                  <AlertTriangle className="h-6 w-6" />
                  Error en Operación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-destructive font-medium">Ocurrió un error:</p> 
                <ScrollArea className="h-[100px] p-2 border border-destructive/30 rounded bg-background/50">
                    <pre className="text-xs text-foreground whitespace-pre-wrap">{currentAnalysisError || currentGitError}</pre> 
                </ScrollArea>
                <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={() => handleCopyLogsToClipboard(currentAnalysisError || currentGitError)} className="text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground">
                        <Copy className="mr-2 h-4 w-4"/> Copiar Mensaje de Error
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleAttemptAutoFix(currentAnalysisError || currentGitError, currentGitError ? "Error ocurrido durante la subida del código fuente a un repositorio Git." : "Error ocurrido durante el auto-análisis del código fuente.")} 
                        disabled={status === "fixing_error" || status === "fixing_git_error" || !apiKey || !modelName}
                        className="text-accent border-accent/50 hover:bg-accent/20 hover:text-accent-foreground"
                    >
                        {(status === "fixing_error" || status === "fixing_git_error") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4"/>}
                         Auto-Fix (Experimental)
                    </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {(status === "fixing_error" || status === "fixing_git_error") && (
             <div className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[150px] mt-6">
              <Loader2 className="h-10 w-10 animate-spin text-accent mb-4" />
              <p className="text-lg text-foreground">Intentando obtener sugerencia de Auto-Corrección...</p>
             </div>
          )}

        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            <strong>Nota Importante:</strong> El análisis se realiza sobre el código fuente completo de CodeAlchemist, potencialmente dividido en fragmentos para manejar límites de tokens y timeouts.
            La descarga de código fuente proporciona un archivo ZIP. La subida a Git también utiliza el estado actual del código.
            Las sugerencias de IA y su aplicación siempre deben ser revisadas cuidadosamente por un desarrollador.
          </p>
        </CardFooter>
      </Card>

      <AlertDialog open={isAutoFixModalOpen} onOpenChange={setIsAutoFixModalOpen}>
          <AlertDialogContent className="max-w-2xl">
              <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-accent">
                      <Settings2 className="h-6 w-6 text-accent"/>
                      Sugerencia de Auto-Corrección de Error
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                      La IA ha analizado el error y propone lo siguiente. Revisa cuidadosamente antes de considerar cualquier acción.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              {autoFixSuggestion && (
                  <ScrollArea className="max-h-[60vh] p-1 -mx-1">
                      <div className="space-y-3 p-3 border rounded-md bg-card">
                          <div>
                              <h4 className="font-semibold text-sm mb-1 text-foreground">Posible Causa Raíz:</h4>
                              <p className="text-xs text-foreground whitespace-pre-wrap">{autoFixSuggestion.root_cause_analysis}</p>
                          </div>
                          <Separator />
                          <div>
                              <h4 className="font-semibold text-sm mb-1 text-foreground">Sugerencias de Solución:</h4>
                              <p className="text-xs text-foreground whitespace-pre-wrap">{autoFixSuggestion.solution_suggestions}</p>
                          </div>
                      </div>
                  </ScrollArea>
              )}
              <AlertDialogFooter className="mt-4">
                  <AlertDialogCancel onClick={() => setIsAutoFixModalOpen(false)}>Cerrar</AlertDialogCancel>
                  {(status === "error" && currentGitError && gitUploadRetryCount < MAX_GIT_UPLOAD_RETRIES) && (
                    <AlertDialogAction 
                      onClick={handleRetryGitUploadFromModal}
                      className="bg-primary hover:bg-primary/90"
                      disabled={isProcessing}
                    >
                      {isProcessing && status === "uploading_git" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitFork className="mr-2 h-4 w-4"/>}
                      Reintentar Subida a Git ({gitUploadRetryCount}/{MAX_GIT_UPLOAD_RETRIES})
                    </AlertDialogAction>
                  )}
                  {(status === "error" && currentAnalysisError) && (
                     <AlertDialogAction 
                      onClick={() => {
                        setIsAutoFixModalOpen(false);
                        handleStartAutoAnalysis(true); // true for retry
                      }}
                      className="bg-primary hover:bg-primary/90"
                      disabled={isProcessing}
                    >
                      {isProcessing && (status === "loading_source" || status === "analyzing") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4"/>}
                       Reintentar Análisis
                    </AlertDialogAction>
                  )}
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

    



