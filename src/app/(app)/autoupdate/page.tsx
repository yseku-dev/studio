'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, DownloadCloud, FileCode, Wand2, CheckCircle, XCircle, Info, Edit3, Copy, Settings2, ListOrdered, ShieldAlert, GitFork, Trash2, Expand, Minimize, Workflow, Bug, Github } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { handleAutoAnalyzeAppSource, getApplicationSourceBundle, applySuggestedChange, handleGetErrorFixSuggestion, handleUploadToGit, initiateAutoUpdateWorkgroupAnalysis } from './actions';
import type { AppSourceFile } from '@/types/project';
import type { ProjectAnalysisResponse, SuggestionItem } from '@/services/groq';
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
import { Input } from '@/components/ui/input';
import JSZip from 'jszip';
import { Label } from '@/components/ui/label';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import { LOCALSTORAGE_AGENTS_KEY, LOCALSTORAGE_WORKGROUPS_KEY, REFACTOR_AGENT_NAME, MAX_WORKGROUP_TURNS, ORCHESTRATOR_AGENT_NAME } from '@/config/agent-config';
import {
    LLM_PROVIDERS,
    LOCALSTORAGE_GIT_REPO_URL_KEY,
    LOCALSTORAGE_GIT_USERNAME_KEY,
    LOCALSTORAGE_GIT_EMAIL_KEY,
    LOCALSTORAGE_GIT_PAT_KEY,
    LOCALSTORAGE_PROVIDER_ID_KEY,
    getLocalStorageApiKeyName,
    getLocalStorageModelName,
    type LLMProviderId
} from '@/config/llm-config';
import { useDebug, type DebugLogEntry } from '@/contexts/DebugContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LLMOptions } from '@/services/groq';


type AutoUpdateStatus = "idle" | "loading_source" | "chunking_source" | "analyzing" | "success" | "error" | "fixing_error" | "uploading_git" | "fixing_git_error";

type SuggestionStatus = "pending" | "applying" | "applied" | "error_applying" | "not_applicable";


// Define the type for a single suggestion item from the response
// Correctly extend the type of an element in the 'suggestions' array
interface SingleSuggestion extends SuggestionItem {
  id?: string; // id might not exist initially, make it optional
  // Add other fields from the base type if needed, e.g.:
  area: string;
  // suggestion: string; // Already in SuggestionItem
  // priority?: 'high' | 'medium' | 'low'; // Already in SuggestionItem
  // suggestedFullFileContent?: string; // Already in SuggestionItem
}


interface SuggestionWithStatus extends SingleSuggestion {
  id: string;
  status: SuggestionStatus;
  errorMessage?: string;
  originalContent?: string; // To store the original content for diff or re-application
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
  const [analysisResult, setAnalysisResult] = useState<ProjectAnalysisResponse | null>(null);
  const [currentAnalysisError, setCurrentAnalysisError] = useState<string | null>(null);
  const [suggestionsWithStatus, setSuggestionsWithStatus] = useState<SuggestionWithStatus[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [projectFiles, setProjectFiles] = useState<AppSourceFile[]>([]);
  const [analysisPreferences, setAnalysisPreferences] = useState<string>("");
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({ processed: 0, total: 0 });
  const [autoFixSuggestion, setAutoFixSuggestion] = useState<SuggestErrorFixOutput | null>(null);
  const [isAutoFixModalOpen, setIsAutoFixModalOpen] = useState(false);
  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const { addDebugLog } = useDebug();

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [gitSourceUrl, setGitSourceUrl] = useState<string>("");
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('');
  const [currentLlmOptions, setCurrentLlmOptions] = useState<LLMOptions | null>(null);

  const [gitConfig, setGitConfig] = useState<GitConfig>({ repoUrl: null, username: null, email: null, pat: null });
  const [gitUploadRetryCount, setGitUploadRetryCount] = useState(0);
  const MAX_GIT_UPLOAD_RETRIES = 5;
  const [currentGitError, setCurrentGitError] = useState<string | null>(null);

  const isMountedRef = useRef(false);


  const { toast } = useToast();

  useEffect(() => {
    isMountedRef.current = true;
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Componente AutoUpdatePage montado.' });

    let loadedAgents: AgentConfig[] = [];
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try {
        loadedAgents = JSON.parse(storedAgents);
        setAgents(loadedAgents);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: 'Agentes cargados desde localStorage.', data: { count: loadedAgents.length } });
      } catch (e) {
        console.error("Error parsing stored agents:", e);
        setAgents([]);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: 'Error al parsear agentes de localStorage.', data: e });
      }
    } else {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: 'No se encontraron agentes en localStorage.' });
    }

    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
        try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: 'Error al parsear grupos de localStorage.', data: e});}
    }

    const refactorAgent = loadedAgents.find(a => a.name === REFACTOR_AGENT_NAME);
    if (refactorAgent) {
      setSelectedConfigSource(`agent:${refactorAgent.id}`);
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Fuente de configuración por defecto establecida a: Agente ${REFACTOR_AGENT_NAME}` });
    } else {
      // Attempt to find a group that contains the RefactorAgent (if it were to exist) and an Orchestrator
      const suitableGroup = workgroups.find(wg =>
        wg.agentIds.some(id => loadedAgents.find(a => a.id === id)?.name === REFACTOR_AGENT_NAME) &&
        wg.agentIds.some(id => loadedAgents.find(a => a.id === id)?.name === ORCHESTRATOR_AGENT_NAME)
      );
      if (suitableGroup) {
        setSelectedConfigSource(`workgroup:${suitableGroup.id}`);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Fuente de configuración por defecto establecida a: Grupo ${suitableGroup.name}` });
      } else {
        setSelectedConfigSource('global'); // Fallback to global if no specific agent or suitable group is found
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: `Agente ${REFACTOR_AGENT_NAME} no encontrado ni un grupo adecuado. Se usará la configuración global por defecto.` });
      }
    }


    setGitConfig({
      repoUrl: localStorage.getItem(LOCALSTORAGE_GIT_REPO_URL_KEY),
      username: localStorage.getItem(LOCALSTORAGE_GIT_USERNAME_KEY),
      email: localStorage.getItem(LOCALSTORAGE_GIT_EMAIL_KEY),
      pat: localStorage.getItem(LOCALSTORAGE_GIT_PAT_KEY),
    });

    return () => {
      isMountedRef.current = false;
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Componente AutoUpdatePage desmontado.' });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDebugLog]); // Removed workgroups from dependency array, as it's loaded inside and might cause loop if setSelectedConfigSource triggers re-render

  useEffect(() => {
    if (!selectedConfigSource) return;

    const localStorageSnapshot: LocalStorageSnapshot = {
      [LOCALSTORAGE_PROVIDER_ID_KEY]: typeof window !== 'undefined' ? localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null : null,
      apiKeys: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageApiKeyName(p.id)) : null; return acc; }, {} as LocalStorageSnapshot['apiKeys']),
      modelNames: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageModelName(p.id)) : null; return acc; }, {} as LocalStorageSnapshot['modelNames']),
      apiUrls: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(`codealchemist_apiurl_${p.id}`) : null; return acc; }, {} as LocalStorageSnapshot['apiUrls']),
    };
    const options = resolveLlmOptionsForSource(selectedConfigSource, agents, workgroups, localStorageSnapshot);
    setCurrentLlmOptions(options);
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: `Opciones LLM resueltas para ${getSourceName(selectedConfigSource)}`, data: options });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConfigSource, agents, workgroups]);

  const addServerLogsToDebugAndPage = useCallback((serverLogs: string[] | undefined, sourcePrefix: string = 'SERVER_AUTOUDDATE') => {
    if (serverLogs) {
      setDetailedLogs(prev => [...prev, ...serverLogs]);
      if (isMountedRef.current) {
          serverLogs.forEach(logMsg => {
              const match = logMsg.match(/^\[(.*?)\]\s\[(.*?)\]\s(.*?)(?:\s\|\sData:\s(.*))?$/) ||
                            logMsg.match(/^\[(.*?)\s(.*?)]\s\[(.*?)\]\s(.*?)(?:\s\|\sData:\s(.*))?$/) ||
                            logMsg.match(/^\[(.*?)\]\s\[(.*?)\]\s(.*?)(?:\s\|\sData:\s(.*))?$/);

              let parsedLog: Omit<DebugLogEntry, 'timestamp'>;

              if (match && match.length >= 5) {
                  let source = sourcePrefix;
                  let type: DebugLogEntry['type'] = 'INFO';
                  let message = '';
                  let dataStr: string | undefined = undefined;

                  if (match[0].startsWith(`[${sourcePrefix}`)) {
                      source = match[1];
                      type = match[3].toUpperCase() as DebugLogEntry['type'];
                      message = match[4];
                      dataStr = match[5];
                  } else {
                      type = match[2].toUpperCase() as DebugLogEntry['type'];
                      message = match[3];
                      dataStr = match[4];
                  }

                  let data: any = undefined;
                  if (dataStr) {
                      try {
                          data = JSON.parse(dataStr);
                      } catch {
                          data = dataStr;
                      }
                  }
                  parsedLog = { source, type, message, data };
              } else {

                  parsedLog = { source: sourcePrefix, type: 'INFO', message: logMsg };
              }
              addDebugLog(parsedLog);
          });
      }
    }
  }, [addDebugLog]);


  const processAnalysisResult = useCallback((data: ProjectAnalysisResponse) => {
    setAnalysisResult(data);
    const initialSuggestions = (data.suggestions || []).map((s, index) => {
      const relatedFile = projectFiles?.find(f => {
        if (!s.area) return false;
        const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
        const areaLower = normalizePath(s.area.toLowerCase());
        const fileNameLower = normalizePath(f.fileName.toLowerCase());
        const baseAreaLower = areaLower.split(' (parte ')[0];
        return fileNameLower === baseAreaLower;
      });
      let currentStatus: SuggestionStatus = "pending";
      if (!s.area || !s.suggestedFullFileContent || !relatedFile?.content) {
        currentStatus = "not_applicable";
      }
      return { ...s, id: `suggestion-${index}-${Date.now()}`, status: currentStatus, originalContent: relatedFile?.content };
    });
    setSuggestionsWithStatus(initialSuggestions as SuggestionWithStatus[]);
    setStatus("success");
    toast({ title: "Análisis Completado", description: `Se han generado sugerencias.` });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Análisis completado y resultados procesados en UI.', data });
  }, [projectFiles, toast, addDebugLog]);

  const handleStartAutoAnalysis = async (isRetry: boolean = false) => {
    setDetailedLogs([]);
    const isWorkgroupMode = selectedConfigSource.startsWith('workgroup:');

    if (!selectedConfigSource) {
        const errorMsg = `Por favor, selecciona una fuente de configuración LLM (Agente o Grupo).`;
        toast({ title: "Error de Configuración LLM", description: errorMsg, variant: "destructive", duration: 7000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-Análisis fallido: ${errorMsg}` });
        return;
    }


    if (!isWorkgroupMode && !currentLlmOptions) {
        const errorMsg = `La configuración LLM para '${getSourceName(selectedConfigSource)}' está incompleta o no es válida.`;
        toast({ title: "Error de Configuración LLM", description: errorMsg, variant: "destructive", duration: 7000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-Análisis fallido: ${errorMsg}` });
        return;
    }
    if (isWorkgroupMode) {
        const workgroupId = selectedConfigSource.split(':')[1];
        const workgroup = workgroups.find(wg => wg.id === workgroupId);
        if (!workgroup) {
            const errorMsg = `Grupo de trabajo '${getSourceName(selectedConfigSource)}' no encontrado.`;
            toast({ title: "Error de Configuración de Grupo", description: errorMsg, variant: "destructive", duration: 7000 });
            addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-Análisis fallido: ${errorMsg}` });
            return;
        }
        const orchestratorInGroup = agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
        if (!orchestratorInGroup) {
            const errorMsg = `Grupo de trabajo '${workgroup.name}' no tiene un Orquestador (${ORCHESTRATOR_AGENT_NAME}) asignado o el orquestador no existe.`;
            toast({ title: "Error de Configuración de Grupo", description: errorMsg, variant: "destructive", duration: 7000 });
            addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-Análisis fallido: ${errorMsg}` });
            return;
        }
    }


    if (!isRetry) {
       addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Iniciando nuevo Auto-Análisis con ${getSourceName(selectedConfigSource)}. Limpiando logs previos.` });
    } else {
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Reintentando análisis con ${getSourceName(selectedConfigSource)}...` });
    }

    setStatus("loading_source");
    setAnalysisResult(null);
    setCurrentAnalysisError(null);
    setCurrentGitError(null);
    setSuggestionsWithStatus([]);
    setAnalysisProgress({ processed: 0, total: 0 });
    setAutoFixSuggestion(null);
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: "Paso 1: Obteniendo código fuente de la aplicación..."});

    toast({
      title: isRetry ? "Reintentando Auto-Análisis" : "Auto-Análisis Iniciado",
      description: `Paso 1: Cargando y preparando el código fuente... ${gitSourceUrl ? `desde ${gitSourceUrl}` : '(local)'}`
    });

    const bundleResult = await getApplicationSourceBundle(true, undefined, gitSourceUrl || undefined);
    addServerLogsToDebugAndPage(bundleResult.logsBuilt, 'SERVER_SOURCE_BUNDLE');

    if (!bundleResult.success || !bundleResult.files || !bundleResult.concatenatedSource) {
      const errorMsg = bundleResult.error || "No se pudo obtener el código fuente para analizar.";
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error en Paso 1: ${errorMsg}`});
      handleAnalysisError(errorMsg);
      return;
    }
    setProjectFiles(bundleResult.files);
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Paso 1 completado. ${bundleResult.files?.length || 'Varios'} archivos obtenidos. Contenido concatenado: ${bundleResult.concatenatedSource.length} caracteres.`});


    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Paso 2: Iniciando análisis del código concatenado.`});
    setStatus("analyzing");

    let analysisActionResult;
    let finalAnalysisPreferences = analysisPreferences || "Priorizar la calidad del código, mantenibilidad y buenas prácticas. Todas las sugerencias deben estar en castellano.";
    if (!finalAnalysisPreferences.toLowerCase().includes("castellano") && !finalAnalysisPreferences.toLowerCase().includes("español")) {
        finalAnalysisPreferences += " Todas las sugerencias deben estar en castellano.";
    }


    if (isWorkgroupMode) {
      const workgroupId = selectedConfigSource.split(':')[1];
      const localStorageSnapshot: LocalStorageSnapshot = {
        [LOCALSTORAGE_PROVIDER_ID_KEY]: typeof window !== 'undefined' ? localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null : null,
        apiKeys: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageApiKeyName(p.id)) : null; return acc; }, {} as LocalStorageSnapshot['apiKeys']),
        modelNames: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(getLocalStorageModelName(p.id)) : null; return acc; }, {} as LocalStorageSnapshot['modelNames']),
        apiUrls: LLM_PROVIDERS.reduce((acc, p) => { acc[p.id] = typeof window !== 'undefined' ? localStorage.getItem(`codealchemist_apiurl_${p.id}`) : null; return acc; }, {} as LocalStorageSnapshot['apiUrls']),
      };
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Iniciando análisis con grupo de trabajo ${workgroupId}. Preferencias: "${finalAnalysisPreferences}"`});
      analysisActionResult = await initiateAutoUpdateWorkgroupAnalysis({
        sourceFiles: bundleResult.files,
        concatenatedSource: bundleResult.concatenatedSource,
        gitRepoUrl: gitSourceUrl || undefined,
        workgroupId,
        analysisPreferences: finalAnalysisPreferences,
        agents,
        workgroups,
        localStorageSnapshot
      });
      addServerLogsToDebugAndPage(analysisActionResult.workgroupLogs, 'SERVER_WG_AUTO_ANALYZE');
    } else if (currentLlmOptions) {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Iniciando análisis directo con ${currentLlmOptions.providerId} - ${currentLlmOptions.modelName}. Preferencias: "${finalAnalysisPreferences}"`});
      analysisActionResult = await handleAutoAnalyzeAppSource(
          bundleResult.files,
          currentLlmOptions.providerId,
          currentLlmOptions.apiKey,
          currentLlmOptions.modelName,
          currentLlmOptions.apiUrl,
          finalAnalysisPreferences,
          gitSourceUrl || undefined
      );
      addServerLogsToDebugAndPage(analysisActionResult.detailedExecutionLogs, 'SERVER_AUTO_ANALYZE');
      setAnalysisProgress({ processed: analysisActionResult.chunksProcessed || 0, total: analysisActionResult.totalChunks || 0 });
    } else {
       handleAnalysisError("Error interno: Configuración LLM no disponible para análisis directo.");
       return;
    }


    if (analysisActionResult.success && analysisActionResult.data) {
        processAnalysisResult(analysisActionResult.data);
    } else {
        handleAnalysisError(analysisActionResult.error);
    }
  };

  const handleAnalysisError = (errorMsg: string | undefined) => {
    setStatus("error");
    const finalErrorMsg = errorMsg || "Ocurrió un error desconocido durante el auto-análisis.";
    setCurrentAnalysisError(finalErrorMsg);
    setCurrentGitError(null);
    toast({ title: "Error en Auto-Análisis", description: finalErrorMsg, variant: "destructive", duration: 10000 });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error en auto-análisis: ${finalErrorMsg}` });
  };


  const handleAttemptAutoFix = async (errorToFix?: string | null, errorContext?: string) => {
    const targetError = errorToFix || currentAnalysisError || currentGitError;
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Intentando auto-corrección.', data: { error: targetError, context: errorContext }});

    let llmOptionsForFix = currentLlmOptions;

    if (selectedConfigSource.startsWith('workgroup:')) {
        const workgroupId = selectedConfigSource.split(':')[1];
        const workgroup = workgroups.find(wg => wg.id === workgroupId);
        const orchestrator = workgroup ? agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id)) : undefined;

        if (orchestrator) {
            const snapshot: LocalStorageSnapshot = {
                [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
                apiKeys: {}, modelNames: {}, apiUrls: {}
            };
            LLM_PROVIDERS.forEach(p => {
                snapshot.apiKeys[p.id] = localStorage.getItem(getLocalStorageApiKeyName(p.id));
                snapshot.modelNames[p.id] = localStorage.getItem(getLocalStorageModelName(p.id));
                snapshot.apiUrls[p.id] = localStorage.getItem(`codealchemist_apiurl_${p.id}`);
            });
            llmOptionsForFix = resolveLlmOptionsForSource(`agent:${orchestrator.id}`, agents, workgroups, snapshot);
        } else {
            // Fallback to global if orchestrator specific options can't be resolved
             const snapshot: LocalStorageSnapshot = {
                [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
                apiKeys: {}, modelNames: {}, apiUrls: {}
             };
             LLM_PROVIDERS.forEach(p => {
                snapshot.apiKeys[p.id] = localStorage.getItem(getLocalStorageApiKeyName(p.id));
                snapshot.modelNames[p.id] = localStorage.getItem(getLocalStorageModelName(p.id));
                snapshot.apiUrls[p.id] = localStorage.getItem(`codealchemist_apiurl_${p.id}`);
             });
            llmOptionsForFix = resolveLlmOptionsForSource('global', agents, workgroups, snapshot);
            addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: `No se pudo resolver LLM para orquestador del grupo ${getSourceName(selectedConfigSource)}, usando config global para Auto-Fix.`});
        }
    } else if (!llmOptionsForFix) { // If not workgroup and still no options (e.g. global incomplete)
         const snapshot: LocalStorageSnapshot = {
            [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
            apiKeys: {}, modelNames: {}, apiUrls: {}
         };
         LLM_PROVIDERS.forEach(p => {
            snapshot.apiKeys[p.id] = localStorage.getItem(getLocalStorageApiKeyName(p.id));
            snapshot.modelNames[p.id] = localStorage.getItem(getLocalStorageModelName(p.id));
            snapshot.apiUrls[p.id] = localStorage.getItem(`codealchemist_apiurl_${p.id}`);
         });
        llmOptionsForFix = resolveLlmOptionsForSource('global', agents, workgroups, snapshot);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: `LLM para ${getSourceName(selectedConfigSource)} no resuelto, usando config global para Auto-Fix.`});
    }


    if (!llmOptionsForFix) {
      const errorMsg = `Configuración LLM para '${getSourceName(selectedConfigSource)}' (o global como fallback) no resuelta o inválida para Auto-Fix.`;
      toast({ title: "Error de Configuración LLM", description: errorMsg, variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Auto-corrección fallida: ${errorMsg}`});
      return;
    }

    if (!targetError) {
      toast({ title: "Información Faltante", description: "No hay error actual para corregir.", variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: 'Auto-corrección solicitada sin error activo.'});
      return;
    }

    const prevStatus = status;
    let fixingStatus: AutoUpdateStatus = currentGitError ? "fixing_git_error" : "fixing_error";
    setStatus(fixingStatus);
    setAutoFixSuggestion(null);


    toast({ title: "Intentando Auto-Corrección", description: `Consultando a ${llmOptionsForFix.providerId} para una posible solución...` });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Consultando a ${llmOptionsForFix.providerId} para auto-corrección.`});

    const tempLogsForAction: string[] = [];
    const fixResult = await handleGetErrorFixSuggestion(
      targetError,
      llmOptionsForFix.providerId,
      llmOptionsForFix.apiKey,
      llmOptionsForFix.modelName,
      llmOptionsForFix.apiUrl,
      tempLogsForAction,
      errorContext
    );
    addServerLogsToDebugAndPage(tempLogsForAction, 'SERVER_ERROR_FIX');


    if (fixResult.success && fixResult.data) {
      setAutoFixSuggestion(fixResult.data);
      setIsAutoFixModalOpen(true);
      toast({ title: "Sugerencia de Corrección Recibida", description: `La IA (${llmOptionsForFix.providerId}) ha proporcionado una sugerencia.` });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Sugerencia de corrección recibida de la IA.`, data: fixResult.data });
    } else {
      toast({ title: "Error en Auto-Corrección", description: fixResult.error || `No se pudo obtener sugerencia.`, variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error al obtener sugerencia de corrección: ${fixResult.error || "Desconocido"}`, data: fixResult });
    }
    setStatus(prevStatus === "fixing_error" || prevStatus === "fixing_git_error"
        ? (currentAnalysisError || currentGitError ? "error" : (analysisResult ? "success" : "idle"))
        : prevStatus);
  };

  const handleApplySuggestion = async (suggestionId: string) => {
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Intentando aplicar sugerencia ID: ${suggestionId}`});
    const suggestionIndex = suggestionsWithStatus.findIndex(s => s.id === suggestionId);
    if (suggestionIndex === -1) {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `No se encontró la sugerencia con ID: ${suggestionId}`});
      return;
    }
    const suggestionToApply = suggestionsWithStatus[suggestionIndex];

    if (!suggestionToApply.area || !suggestionToApply.originalContent || !suggestionToApply.suggestedFullFileContent) {
      const missingField = !suggestionToApply.area ? "nombre de archivo" : !suggestionToApply.originalContent ? "contenido original" : "contenido sugerido";
      toast({ title: "Error de Aplicación", description: `Falta ${missingField} para ${suggestionToApply.area || 'esta sugerencia'}.`, variant: "destructive" });
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "error_applying", errorMessage: `Falta ${missingField}.` } : s));
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Falta ${missingField} para sugerencia ID: ${suggestionId}`});
      return;
    }

    setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "applying" } : s));
    toast({ title: "Aplicando Sugerencia...", description: `Aplicando cambio a ${suggestionToApply.area}` });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Estado: 'applying'. Llamando a applySuggestedChange para ${suggestionToApply.area}.`});

    const baseFilePath = suggestionToApply.area.includes(" (parte ") ? suggestionToApply.area.split(" (parte ")[0] : suggestionToApply.area;
    const tempLogsForAction: string[] = [];
    const result = await applySuggestedChange(baseFilePath, suggestionToApply.originalContent, suggestionToApply.suggestedFullFileContent, tempLogsForAction);
    addServerLogsToDebugAndPage(tempLogsForAction, 'SERVER_APPLY_SUGGESTION');

    if (result.success && result.newContent !== undefined) {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "applied", originalContent: result.newContent! } : s));
      toast({ title: "Sugerencia Aplicada", description: `El cambio para ${baseFilePath} se ha aplicado.` });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Sugerencia aplicada a ${baseFilePath}.`, data: { newContentLength: result.newContent.length } });
      setProjectFiles(prevFiles => (prevFiles || []).map(pf => {
        const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
        if (normalizePath(pf.fileName.toLowerCase()) === normalizePath(baseFilePath.toLowerCase())) {
          addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: `Actualizando contenido en projectFiles para ${pf.fileName}.`});
          return { ...pf, content: result.newContent! };
        }
        return pf;
      }));
    } else {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "error_applying", errorMessage: result.error } : s));
      toast({ title: "Error al Aplicar", description: result.error || `No se pudo aplicar el cambio a ${baseFilePath}.`, variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error al aplicar sugerencia a ${baseFilePath}: ${result.error}`});
    }
  };

 const handleDownloadSource = async (format: 'zip' | 'json' = 'zip') => {
    setIsDownloading(true);
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Iniciando preparación para descarga de código fuente en formato ${format.toUpperCase()}.`});
    toast({ title: "Preparando Descarga", description: `Recopilando archivos fuente para formato ${format.toUpperCase()}...` });

    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Obteniendo el paquete de código fuente más reciente para la descarga...`});
    const tempLogsForBundle: string[] = [];
    const bundleResult = await getApplicationSourceBundle(false, tempLogsForBundle, gitSourceUrl || undefined);
    addServerLogsToDebugAndPage(tempLogsForBundle, 'SERVER_DOWNLOAD_BUNDLE');

    let filesToProcess: AppSourceFile[] = [];
    if (bundleResult.success && bundleResult.files) {
      filesToProcess = bundleResult.files;
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Paquete de código fuente más reciente obtenido con ${filesToProcess.length} archivos.`});
    } else {
      toast({ title: "Error al Obtener Código", description: bundleResult.error || "No se pudo obtener el código fuente actualizado.", variant: "destructive" });
      setIsDownloading(false);
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error al obtener código para ${format.toUpperCase()}: ${bundleResult.error}`});
      return;
    }

    if (filesToProcess && filesToProcess.length > 0) {
      try {
        let blob: Blob;
        let downloadFileName: string;

        if (format === 'zip') {
          const zip = new JSZip();
          filesToProcess.forEach(file => {
            if (file.fileName && file.fileName.trim() !== "" && !file.content.startsWith("// Archivo binario") && !file.content.startsWith("// Error:")) {
              zip.file(file.fileName, file.content);
            } else {
              addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'WARN', message: `Omitido en ZIP (nombre vacío, binario o error): ${file.fileName}`});
            }
          });
          blob = await zip.generateAsync({ type: "blob" });
          downloadFileName = 'CodeAlchemist-source.zip';
        } else {
          const jsonData = JSON.stringify(filesToProcess, null, 2);
          blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
          downloadFileName = 'CodeAlchemist-source.json';
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Descarga Iniciada", description: `El paquete de código fuente (${format.toUpperCase()}) se está descargando.` });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Descarga ${format.toUpperCase()} iniciada.`});
      } catch (e) {
        const error = e instanceof Error ? e.message : "Error desconocido";
        toast({ title: `Error al Crear Descarga ${format.toUpperCase()}`, description: `No se pudo crear el archivo ${format.toUpperCase()}: ${error}`, variant: "destructive" });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error al crear ${format.toUpperCase()}: ${error}`});
      }
    } else {
      toast({ title: "Error al Obtener Código", description: "No se encontraron archivos para empaquetar.", variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error: No se encontraron archivos para ${format.toUpperCase()}.`});
    }
    setIsDownloading(false);
  };

  const performGitUpload = async (isRetry: boolean = false) => {
    const { repoUrl, username, email, pat } = gitConfig;
    if (!repoUrl || !username || !email || !pat) {
      toast({ title: "Configuración Git Incompleta", description: "Completa la configuración en Ajustes.", variant: "destructive" });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: 'Subida a Git fallida: Configuración incompleta.'});
      setStatus(analysisResult ? "success" : "idle");
      return;
    }
    setCurrentGitError(null);
    setCurrentAnalysisError(null);
    setStatus("uploading_git");
    setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] [INFO] Iniciando subida a Git...`]);

    const attemptNumber = isRetry ? gitUploadRetryCount + 1 : 1;
    if (isRetry) setGitUploadRetryCount(attemptNumber);

    const commitMsg = `CodeAlchemist: AutoUpdate Sync (Attempt ${attemptNumber} - ${new Date().toISOString()})`;
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `${isRetry ? `Reintentando (${attemptNumber}/${MAX_GIT_UPLOAD_RETRIES})` : 'Iniciando'} subida a Git...`, data: { repoUrl, commitMsg }});
    toast({ title: `${isRetry ? `Reintentando Subida Git (${attemptNumber})` : "Subiendo a Git..."}`, description: `Intentando subir a ${repoUrl.split('/').pop()?.replace('.git', ' ')}` });

    const tempLogsForAction: string[] = [];
    const result = await handleUploadToGit({ repoUrl, username, email, pat }, commitMsg, tempLogsForAction);
    addServerLogsToDebugAndPage(tempLogsForAction, 'SERVER_GIT_UPLOAD');

    if (result.success) {
      toast({ title: "Subida a Git Exitosa", description: result.message, duration: 7000 });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Subida a Git exitosa.', data: result });
      setGitUploadRetryCount(0);
      setStatus(analysisResult ? "success" : "idle");
    } else {
      setCurrentGitError(result.message);
      toast({
        title: `Error en Subida a Git${isRetry ? ` (Intento ${attemptNumber})` : ''}`,
        description: result.message, variant: "destructive", duration: 10000,
        action: (attemptNumber < MAX_GIT_UPLOAD_RETRIES) ? (
          <Button variant="outline" size="sm" className="ml-auto border-destructive/50 text-destructive hover:bg-destructive/20 hover:text-destructive-foreground"
            onClick={() => handleAttemptAutoFix(result.message, "Error durante subida a Git.")}>
            <Settings2 className="mr-2 h-4 w-4" /> Auto-Fix
          </Button>
        ) : undefined
      });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error en subida a Git: ${result.message}`, data: result });
      setStatus("error");
    }
  };
  const handleInitialGitUpload = () => { setGitUploadRetryCount(0); performGitUpload(false); };
  const handleRetryGitUploadFromModal = () => { setIsAutoFixModalOpen(false); performGitUpload(true); };

  const isProcessing = ["analyzing", "loading_source", "chunking_source", "fixing_error", "uploading_git", "fixing_git_error"].includes(status);
  const isGitConfigured = gitConfig.repoUrl && gitConfig.username && gitConfig.email && gitConfig.pat;

  const sourceDescription = gitSourceUrl ? `Git: ${gitSourceUrl.split('/').pop() || gitSourceUrl}` : 'Local';

  const getSourceName = (sourceId: string): string => {
    if (!sourceId) return 'Seleccionar fuente';

    if (sourceId === 'global') return 'Global (Ajustes Generales)';

    const refactorAgent = agents.find(a => a.name === REFACTOR_AGENT_NAME);
    if (sourceId === `agent:${refactorAgent?.id}`) return `Agente: ${REFACTOR_AGENT_NAME} (Por defecto)`;

    if (sourceId.startsWith('agent:')) {
      const agentId = sourceId.split(':')[1];
      return agents.find(a => a.id === agentId)?.name || `Agente ${agentId.substring(0,6)}...`;
    }
    if (sourceId.startsWith('workgroup:')) {
      const workgroupId = sourceId.split(':')[1];
      return workgroups.find(wg => wg.id === workgroupId)?.name || `Grupo ${workgroupId.substring(0,6)}...`;
    }
    return `Desconocido (${sourceId})`;
  };

  let llmConfigDisplayStatus = "";
  const isWorkgroupSelected = selectedConfigSource.startsWith('workgroup:');

  if (!selectedConfigSource) {
    llmConfigDisplayStatus = "Error: Por favor, selecciona un Agente o Grupo para el análisis.";
  } else if (!isWorkgroupSelected && !currentLlmOptions) {
    llmConfigDisplayStatus = `Error: Configuración LLM para '${getSourceName(selectedConfigSource)}' incompleta.`;
  } else if (!isWorkgroupSelected && currentLlmOptions) {
    llmConfigDisplayStatus = `Análisis con: ${getSourceName(selectedConfigSource)} (${currentLlmOptions.providerId} - ${currentLlmOptions.modelName})`;
  } else if (isWorkgroupSelected) {
      const workgroupId = selectedConfigSource.split(':')[1];
      const workgroup = workgroups.find(wg => wg.id === workgroupId);
      if (workgroup) {
        const orchestrator = agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
        if (orchestrator) {
             const localStorageSnapshot: LocalStorageSnapshot = {
                [LOCALSTORAGE_PROVIDER_ID_KEY]: localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null,
                apiKeys: {}, modelNames: {}, apiUrls: {}
             };
             LLM_PROVIDERS.forEach(p => {
                localStorageSnapshot.apiKeys[p.id] = localStorage.getItem(getLocalStorageApiKeyName(p.id));
                localStorageSnapshot.modelNames[p.id] = localStorage.getItem(getLocalStorageModelName(p.id));
                localStorageSnapshot.apiUrls[p.id] = localStorage.getItem(`codealchemist_apiurl_${p.id}`);
             });
             const orchestratorOptions = resolveLlmOptionsForSource(`agent:${orchestrator.id}`, agents, workgroups, localStorageSnapshot);
             if (orchestratorOptions) {
                llmConfigDisplayStatus = `Análisis con Grupo: ${workgroup.name} (Orquestador usa: ${orchestratorOptions.providerId} - ${orchestratorOptions.modelName})`;
             } else {
                llmConfigDisplayStatus = `Error: Configuración LLM para Orquestador del grupo '${workgroup.name}' incompleta.`;
             }
        } else {
            llmConfigDisplayStatus = `Error: Grupo '${workgroup.name}' no tiene Orquestador (${ORCHESTRATOR_AGENT_NAME}) asignado.`;
        }
      } else {
        llmConfigDisplayStatus = `Error: Grupo '${getSourceName(selectedConfigSource)}' no encontrado.`;
      }
  }

  const refactorAgentInstance = agents.find(a => a.name === REFACTOR_AGENT_NAME);
  const filteredWorkgroups = workgroups.filter(wg =>
    wg.agentIds.some(id => agents.find(a => a.id === id)?.name === REFACTOR_AGENT_NAME) &&
    wg.agentIds.some(agentId => agents.find(a => a.id === agentId)?.name === ORCHESTRATOR_AGENT_NAME)
  );


  return (
    <> {/* Added Fragment */}
      <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            AutoUpdate: Análisis de CodeAlchemist
          </CardTitle>
          <CardDescription className="text-lg text-foreground">
            Analiza el código fuente de CodeAlchemist (local o desde Git) usando un agente o grupo de trabajo especializado.
            <span className={cn("block mt-1", (llmConfigDisplayStatus.startsWith("Error:")) ? "text-destructive" : "text-foreground")}>
                {llmConfigDisplayStatus}
            </span>
             <span className="text-foreground block mt-1">(Fuente actual: {sourceDescription})</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
             <div className="space-y-2">
                <Label htmlFor="configSourceAutoUpdate" className="text-base flex items-center gap-1"><Settings2 className="h-4 w-4"/> Usar para Análisis:</Label>
                <Select onValueChange={setSelectedConfigSource} value={selectedConfigSource}>
                    <SelectTrigger id="configSourceAutoUpdate" className="w-full">
                        <SelectValue placeholder="Seleccionar Agente o Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                        <ScrollArea className="h-[--radix-select-content-available-height] max-h-60">
                            <SelectItem value="global">Global (Ajustes Generales)</SelectItem>
                            {refactorAgentInstance && (
                                <SelectItem value={`agent:${refactorAgentInstance.id}`}>
                                    Agente: {REFACTOR_AGENT_NAME} (Recomendado)
                                </SelectItem>
                            )}
                            {filteredWorkgroups.map(wg => (
                                <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>
                                    Grupo: {wg.name} (Contiene {REFACTOR_AGENT_NAME})
                                </SelectItem>
                            ))}
                            {agents.filter(a => a.name !== REFACTOR_AGENT_NAME).map(agent => (
                                <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>
                                    Agente: {agent.name}
                                </SelectItem>
                            ))}
                             {workgroups.filter(wg => !filteredWorkgroups.find(fwg => fwg.id === wg.id)).map(wg => (
                                <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>
                                    Grupo: {wg.name}
                                </SelectItem>
                            ))}
                        </ScrollArea>
                    </SelectContent>
                </Select>
                {(!selectedConfigSource && !refactorAgentInstance) &&
                    <p className="text-xs text-destructive mt-1">Por favor, crea el agente '{REFACTOR_AGENT_NAME}' o selecciona una fuente de configuración.</p>
                }
             </div>
             <div className="space-y-2">
              <Label htmlFor="gitSourceUrl" className="text-base flex items-center gap-1"><Github className="h-4 w-4" /> URL del Repositorio Git (Opcional)</Label>
              <Input
                id="gitSourceUrl"
                type="url"
                value={gitSourceUrl}
                onChange={(e) => setGitSourceUrl(e.target.value)}
                placeholder="Ej: https://github.com/usuario/repo.git (deja vacío para local)"
                className="bg-card text-foreground"
              />
              <p className="text-xs text-muted-foreground">Si se proporciona, se analizará este repositorio en lugar del código local.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis-preferences" className="text-base flex items-center gap-2 text-foreground"><Edit3 className="h-5 w-5" /> Preferencias de Análisis (Opcional)</Label>
            <Textarea id="analysis-preferences" value={analysisPreferences} onChange={(e) => setAnalysisPreferences(e.target.value)}
              placeholder="Ej: 'Enfócate en optimizar el rendimiento de la UI...', 'Revisa la seguridad en las llamadas API...', 'Todas las sugerencias deben estar en castellano.'" rows={3} className="bg-card text-foreground" />
            <p className="text-xs text-muted-foreground">Describe qué tipo de actualizaciones o áreas te gustaría que la IA priorizara. Especifica el idioma si es necesario.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => handleStartAutoAnalysis(false)}
              disabled={isProcessing || !selectedConfigSource || (!isWorkgroupSelected && !currentLlmOptions) || (isWorkgroupSelected && (!workgroups.find(wg => wg.id === selectedConfigSource.split(':')[1]) || !agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME))) }
              className="text-base py-3 px-6"
            >
              {isProcessing && (status === "analyzing" || status === "loading_source" || status === "chunking_source") ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              Iniciar Auto-Análisis
            </Button>
            <Button onClick={() => handleDownloadSource('zip')} disabled={isDownloading} variant="outline" className="text-base py-3 px-6 text-foreground">
              {isDownloading && format === 'zip' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DownloadCloud className="mr-2 h-5 w-5" />} Descargar Código (ZIP)
            </Button>
             <Button onClick={() => handleDownloadSource('json')} disabled={isDownloading} variant="outline" className="text-base py-3 px-6 text-foreground">
              {isDownloading && format === 'json' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DownloadCloud className="mr-2 h-5 w-5" />} Descargar Código (JSON)
            </Button>
            <Button onClick={handleInitialGitUpload} disabled={!isGitConfigured || isProcessing} variant="outline" className="text-base py-3 px-6 text-foreground"
              title={!isGitConfigured ? "Configura Git en Ajustes." : "Subir código a Git"}>
              {status === "uploading_git" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GitFork className="mr-2 h-5 w-5" />} Subir a Git
            </Button>
          </div>

          {(isProcessing || status === "success" || status === "error") && (
            <div className="mt-4 space-y-2">
              <Label className="text-sm text-foreground">
                {status === "loading_source" ? "Paso 1: Cargando código fuente..." :
                 status === "chunking_source" ? "Paso 1.5: Dividiendo código en fragmentos..." :
                 status === "analyzing" && analysisProgress.total > 0 ? `Paso 2: Procesando fragmentos LLM... (${analysisProgress.processed}/${analysisProgress.total})` : status === "analyzing" ? "Paso 2: Calculando fragmentos para LLM..." :
                 status === "success" ? `Operación completada ${analysisProgress.total > 0 ? `(${analysisProgress.processed}/${analysisProgress.total} fragmentos).` : '' }` :
                 status === "error" && (currentAnalysisError || currentGitError) ? `Operación interrumpida.` :
                 status === "uploading_git" ? `Subiendo a Git (Intento ${gitUploadRetryCount + 1}/${MAX_GIT_UPLOAD_RETRIES})...` :
                 status === "fixing_error" ? "Intentando auto-corrección de error de análisis..." :
                 status === "fixing_git_error" ? "Intentando auto-corrección de error Git..." : "Estado desconocido"}
              </Label>
              {(status !== "success" && status !== "error" && status !== "idle") && (
                <Progress value={
                  status === "loading_source" ? 5 :
                  status === "chunking_source" ? 10 :
                  status === "analyzing" && analysisProgress.total === 0 ? 15 :
                  status === "analyzing" && analysisProgress.total > 0 ? 15 + (analysisProgress.processed / analysisProgress.total) * 80 :
                  (status === "uploading_git" || status === "fixing_error" || status === "fixing_git_error" ? 95 : 0) // Keep a high value for these
                } className="w-full h-3" />
              )}
            </div>
          )}

          {analysisResult && status === "success" && (
            <Card className="mt-6 border-accent bg-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2 text-accent"><FileCode className="h-6 w-6" /> {analysisResult.analysisTitle}</CardTitle>
                <CardDescription>Analizado usando '{getSourceName(selectedConfigSource)}'. Fuente: {sourceDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Evaluación General:</h4>
                  <ScrollArea className="h-[100px] p-2 border rounded bg-background/50"><pre className="text-xs text-foreground/80 whitespace-pre-wrap">{analysisResult.overallAssessment}</pre></ScrollArea>
                </div>
                <Separator />
                {analysisResult.identifiedAreas.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Áreas Identificadas:</h4>
                    <div className="flex flex-wrap gap-2">{analysisResult.identifiedAreas.map((area, index) => <Badge key={index} variant="secondary" className="text-foreground">{area}</Badge>)}</div>
                  </div>
                )}
                {suggestionsWithStatus.length > 0 && <Separator />}
                {suggestionsWithStatus.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Sugerencias Detalladas ({suggestionsWithStatus.length}):</h4>
                    <div className="p-3 my-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-md flex items-start gap-2">
                      <ShieldAlert className="h-5 w-5 text-yellow-700 dark:text-yellow-300 shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-800 dark:text-yellow-200"><strong>¡Atención!</strong> Aplicar estas sugerencias modificará directamente los archivos del código fuente. Asegúrate de entender los cambios.</p>
                    </div>
                    <ScrollArea className="h-[400px] pr-3">
                      <ul className="space-y-3">
                        {suggestionsWithStatus.map((s) => (
                          <li key={s.id} className="p-3 rounded-md border bg-background/80 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-sm text-foreground break-all">{s.area || "Sugerencia General"}</span>
                              {s.priority && <Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'default' : 'outline'} className="capitalize text-xs shrink-0 ml-2">{s.priority}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{s.suggestion}</p>
                            {s.status === "error_applying" && s.errorMessage && (
                              <div className="p-2 my-1 bg-destructive/10 border border-destructive/30 rounded-md">
                                <p className="text-xs text-destructive ">Error al aplicar: {s.errorMessage}</p>
                                <Button variant="ghost" size="sm" onClick={() => addDebugLog({ source: 'AUTOUPDATE_UI', type: 'ERROR', message: `Error copiado de sugerencia ${s.id}`, data: s.errorMessage})} className="mt-1 h-6 px-1.5 text-xs text-destructive hover:bg-destructive/20"><Copy className="mr-1 h-3 w-3" /> Copiar Error</Button>
                              </div>
                            )}
                            {s.status === "not_applicable" && <p className="text-xs text-muted-foreground mt-1 mb-1">No aplicable directamente. {s.suggestedFullFileContent === undefined ? 'No se proporcionó contenido modificado.' : !s.originalContent ? 'Falta contenido original.' : ''}</p>}
                            <div className="flex items-center gap-2 mt-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" disabled={s.status === "applying" || s.status === "applied" || s.status === "not_applicable"}
                                    className={cn(s.status === "applied" && "border-green-500 text-green-700 dark:text-green-400", s.status === "error_applying" && "border-destructive text-destructive", "text-foreground")}>
                                    {s.status === "applying" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {s.status === "applied" && <CheckCircle className="mr-2 h-4 w-4 text-green-600 dark:text-green-500" />}
                                    {s.status === "error_applying" && <XCircle className="mr-2 h-4 w-4 text-destructive" />}
                                    {s.status === "pending" && <Wand2 className="mr-2 h-4 w-4" />}
                                    {s.status === "not_applicable" && <Info className="mr-2 h-4 w-4 text-muted-foreground" />}
                                    {s.status === "applied" ? "Aplicada" : s.status === "applying" ? "Aplicando..." : s.status === "error_applying" ? "Reintentar" : s.status === "not_applicable" ? "No Aplicable" : "Aplicar Sugerencia"}
                                  </Button>
                                </AlertDialogTrigger>
                                {s.status !== "not_applicable" && s.status !== "applied" && (
                                  <AlertDialogContent className="max-w-3xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-foreground flex items-center gap-2"><ShieldAlert className="text-destructive h-6 w-6" />¿Aplicar esta sugerencia?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Se intentará aplicar la sugerencia al archivo <strong className="text-foreground">{s.area}</strong>.
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] text-xs">
                                          <div><p className="font-semibold mb-1 text-foreground">Original (Fragmento):</p><ScrollArea className="h-60 border rounded p-2 bg-muted/30"><pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{s.originalContent?.substring(0, 1500) || "No disponible"}</pre></ScrollArea></div>
                                          <div><p className="font-semibold mb-1 text-foreground">Sugerido (Fragmento):</p><ScrollArea className="h-60 border rounded p-2 bg-muted/30"><pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{s.suggestedFullFileContent?.substring(0, 1500) || "No disponible"}</pre></ScrollArea></div>
                                        </div>
                                        <strong className="block mt-3 text-destructive">¡Importante!</strong> Esta acción modificará el archivo.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleApplySuggestion(s.id)} className="bg-destructive hover:bg-destructive/90">Sí, aplicar</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                )}
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
          {(status === "loading_source" || status === "chunking_source" || (status === "analyzing" && (!analysisProgress || analysisProgress.total === 0))) && (
            <div data-ai-hint="code processing animation" className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[200px] mt-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-foreground">
                {status === "loading_source" ? "Cargando código..." :
                 status === "chunking_source" ? "Dividiendo código en fragmentos..." :
                 "Preparando análisis..."}
              </p>
              <p className="text-sm text-muted-foreground">Esto podría tomar unos momentos.</p>
            </div>
          )}
          {status === "error" && (currentAnalysisError || currentGitError) && (
            <Card className="mt-6 border-destructive bg-destructive/10">
              <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" />Error en Operación</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-destructive font-medium">Ocurrió un error:</p>
                <ScrollArea className="h-[100px] p-2 border border-destructive/30 rounded bg-background/50"><pre className="text-xs text-foreground whitespace-pre-wrap">{currentAnalysisError || currentGitError}</pre></ScrollArea>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => addDebugLog({ source: 'AUTOUPDATE_UI', type: 'ERROR', message: `Error copiado de UI: ${currentAnalysisError || currentGitError}`})} className="text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground"><Copy className="mr-2 h-4 w-4" /> Copiar Error</Button>
                  <Button variant="outline" size="sm" onClick={() => handleAttemptAutoFix(currentAnalysisError || currentGitError, currentGitError ? "Error en subida Git." : "Error en auto-análisis.")}
                    disabled={status === "fixing_error" || status === "fixing_git_error" || !selectedConfigSource || (!isWorkgroupSelected && !currentLlmOptions) || (isWorkgroupSelected && (!workgroups.find(wg => wg.id === selectedConfigSource.split(':')[1]) || !agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME))) }
                    className="text-accent border-accent/50 hover:bg-accent/20 hover:text-accent-foreground">
                    {(status === "fixing_error" || status === "fixing_git_error") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />} Auto-Fix
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {(status === "fixing_error" || status === "fixing_git_error") && (
            <div className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-8 min-h-[150px] mt-6">
              <Loader2 className="h-10 w-10 animate-spin text-accent mb-4" /><p className="text-lg text-foreground">Intentando obtener sugerencia de Auto-Corrección...</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2">
            <p className="text-xs text-muted-foreground"><strong>Nota:</strong> El análisis se realiza sobre el código completo (local o de Git). La descarga proporciona un ZIP. La subida a Git usa el estado actual del código (local o de Git si fue la fuente). Revisa cuidadosamente las sugerencias de IA.</p>
            {detailedLogs.length > 0 && (
              <Card className="mt-6 border-primary/30 w-full">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2 text-primary"><ListOrdered className="h-5 w-5"/> Logs Detallados</CardTitle>
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
                      <ScrollArea className={cn("p-2 border rounded bg-muted/30 transition-all duration-300 ease-in-out", logsExpanded ? "h-[300px]" : "h-[100px]")}>
                          <pre className="text-xs text-foreground whitespace-pre-wrap">
                              {detailedLogs.map((log, index) => {
                                const isError = log.includes("[ERROR") || log.includes("Error:");
                                const isWarn = log.includes("[WARN");
                                const isDetail = log.includes("[DETAIL");
                                const isChunkAnalysis = log.includes("[CHUNK_ANALYSIS");

                                return (
                                  <span key={`log-${index}`} className={cn(
                                      isError ? "text-destructive"
                                      : isWarn ? "text-yellow-500 dark:text-yellow-400"
                                      : isChunkAnalysis ? "text-sky-600 dark:text-sky-400"
                                      : isDetail ? "text-gray-500 dark:text-gray-400"
                                      : ""
                                  )}>
                                      {log}\n
                                  </span>
                                );
                              })}
                          </pre>
                      </ScrollArea>
                  </CardContent>
              </Card>
            )}
        </CardFooter>
      </Card>
      <AlertDialog open={isAutoFixModalOpen} onOpenChange={setIsAutoFixModalOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-accent"><Settings2 className="h-6 w-6 text-accent" />Sugerencia de Auto-Corrección</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">La IA ha analizado el error. Revisa antes de actuar.</AlertDialogDescription>
          </AlertDialogHeader>
          {autoFixSuggestion && (
            <ScrollArea className="max-h-[60vh] p-1 -mx-1">
              <div className="space-y-3 p-3 border rounded-md bg-card">
                <div><h4 className="font-semibold text-sm mb-1 text-foreground">Posible Causa Raíz:</h4><p className="text-xs text-foreground whitespace-pre-wrap">{autoFixSuggestion.root_cause_analysis}</p></div>
                <Separator />
                <div><h4 className="font-semibold text-sm mb-1 text-foreground">Sugerencias de Solución:</h4><p className="text-xs text-foreground whitespace-pre-wrap">{autoFixSuggestion.solution_suggestions}</p></div>
              </div>
            </ScrollArea>
          )}
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setIsAutoFixModalOpen(false)}>Cerrar</AlertDialogCancel>
            {(status === "error" && currentGitError && gitUploadRetryCount < MAX_GIT_UPLOAD_RETRIES) && (
              <AlertDialogAction onClick={handleRetryGitUploadFromModal} className="bg-primary hover:bg-primary/90" disabled={isProcessing}>
                {isProcessing && status === "uploading_git" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitFork className="mr-2 h-4 w-4" />} Reintentar Subida Git ({gitUploadRetryCount + 1}/{MAX_GIT_UPLOAD_RETRIES})
              </AlertDialogAction>
            )}
            {(status === "error" && currentAnalysisError) && (
              <AlertDialogAction onClick={() => { setIsAutoFixModalOpen(false); handleStartAutoAnalysis(true); }} className="bg-primary hover:bg-primary/90" disabled={isProcessing}>
                {isProcessing && (status === "loading_source" || status === "analyzing" || status === "chunking_source") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Reintentar Análisis
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  );
}