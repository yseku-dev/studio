
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, DownloadCloud, FileCode, Wand2, CheckCircle, XCircle, Info, Edit3, Copy, Settings2, ListOrdered, ShieldAlert, GitFork, Trash2, Expand, Minimize, Workflow } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { handleAutoAnalyzeAppSource, getApplicationSourceBundle, applySuggestedChange, handleGetErrorFixSuggestion, handleUploadToGit } from './actions';
import type { AppSourceFile } from './actions';
import type { ProjectAnalysisResponse, LLMOptions, SuggestionItem } from '@/services/groq';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { resolveLlmOptionsForSource } from '@/lib/llm-utils';
import { LOCALSTORAGE_AGENTS_KEY, LOCALSTORAGE_WORKGROUPS_KEY, ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS } from '@/config/agent-config';
import {
    LOCALSTORAGE_GIT_REPO_URL_KEY,
    LOCALSTORAGE_GIT_USERNAME_KEY,
    LOCALSTORAGE_GIT_EMAIL_KEY,
    LOCALSTORAGE_GIT_PAT_KEY
} from '@/config/llm-config';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import type { ChatMessage } from '@/services/groq';


type AutoUpdateStatus = "idle" | "loading_source" | "chunking_source" | "analyzing" | "processing_workgroup_turn" | "success" | "error" | "fixing_error" | "uploading_git" | "fixing_git_error";

type SuggestionStatus = "pending" | "applying" | "applied" | "error_applying" | "not_applicable";


// Define the type for a single suggestion item from the response
// Correctly extend the type of an element in the 'suggestions' array
// The type ProjectAnalysisResponse['suggestions'][number] is equivalent to SuggestionItem
interface SingleSuggestion extends SuggestionItem {
  id?: string; // id might not exist initially, make it optional
  // Fields like 'area', 'suggestion', 'priority', 'suggestedFullFileContent'
  // are inherited from SuggestionItem and do not need to be re-declared here.
}


interface SuggestionWithStatus extends SingleSuggestion {
  id: string; // Ensure id is always present after processing
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

type LogEntry = {
    timestamp: string;
    type: 'info' | 'agent' | 'error' | 'orchestrator' | 'system' | 'debug';
    agentName?: string;
    message: string;
    llmRequest?: any;
    llmResponse?: any;
};


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

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [workgroups, setWorkgroups] = useState<WorkgroupConfig[]>([]);
  const [selectedConfigSource, setSelectedConfigSource] = useState<string>('global');
  const [resolvedLlmOptions, setResolvedLlmOptions] = useState<LLMOptions | null>(null);

  const [gitConfig, setGitConfig] = useState<GitConfig>({ repoUrl: null, username: null, email: null, pat: null });
  const [gitUploadRetryCount, setGitUploadRetryCount] = useState(0);
  const MAX_GIT_UPLOAD_RETRIES = 5;
  const [currentGitError, setCurrentGitError] = useState<string | null>(null);

  const [workgroupAnalysisLogs, setWorkgroupAnalysisLogs] = useState<LogEntry[]>([]);
  const workgroupExecutionControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(false);
  const [currentWorkgroupTurn, setCurrentWorkgroupTurn] = useState(0); // For workgroup status
  const [workgroupConversationHistory, setWorkgroupConversationHistory] = useState<ChatMessage[]>([]); // Added state


  const { toast } = useToast();

  useEffect(() => {
    isMountedRef.current = true;
    const storedAgents = localStorage.getItem(LOCALSTORAGE_AGENTS_KEY);
    if (storedAgents) {
      try { setAgents(JSON.parse(storedAgents)); } catch (e) { console.error("Error parsing stored agents:", e); setAgents([]); }
    }
    const storedWorkgroups = localStorage.getItem(LOCALSTORAGE_WORKGROUPS_KEY);
    if (storedWorkgroups) {
      try { setWorkgroups(JSON.parse(storedWorkgroups)); } catch (e) { console.error("Error parsing stored workgroups:", e); setWorkgroups([]); }
    }
    setGitConfig({
      repoUrl: localStorage.getItem(LOCALSTORAGE_GIT_REPO_URL_KEY),
      username: localStorage.getItem(LOCALSTORAGE_GIT_USERNAME_KEY),
      email: localStorage.getItem(LOCALSTORAGE_GIT_EMAIL_KEY),
      pat: localStorage.getItem(LOCALSTORAGE_GIT_PAT_KEY),
    });

    // Initial log entry
    const initialClientLog = `[CLIENT ${new Date().toISOString()}] AutoUpdatePage montado.`;
    setDetailedLogs(prev => [...prev, initialClientLog]);
    
    return () => {
      isMountedRef.current = false;
      if (workgroupExecutionControllerRef.current) {
        workgroupExecutionControllerRef.current.abort();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const options = resolveLlmOptionsForSource(selectedConfigSource, agents, workgroups);
    setResolvedLlmOptions(options);
  }, [selectedConfigSource, agents, workgroups]);

  const addDetailedLog = useCallback((message: string, isClientLog: boolean = true) => {
    if (isMountedRef.current) {
      const prefix = isClientLog ? `[CLIENT ${new Date().toISOString()}]` : '';
      setDetailedLogs(prev => [...prev, `${prefix} ${message}`]);
    }
  }, []);
  
  const addServerLogs = useCallback((serverLogs: string[] | undefined) => {
    if (isMountedRef.current && serverLogs) {
        // Server logs already have timestamps and prefixes
        setDetailedLogs(prev => [...prev, ...serverLogs]);
    }
  }, []);


  const addWorkgroupLog = useCallback((logEntry: Omit<LogEntry, 'timestamp'>) => {
    if (isMountedRef.current) {
      const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
      setWorkgroupAnalysisLogs(prev => [...prev, { ...logEntry, timestamp }]);
    }
  }, []);


  const processAnalysisResult = useCallback((data: ProjectAnalysisResponse) => {
    setAnalysisResult(data);
    const initialSuggestions = data.suggestions.map((s, index) => {
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
    addDetailedLog(`Análisis completado y resultados procesados en UI.`);
  }, [projectFiles, toast, addDetailedLog]);


  const runWorkgroupAnalysisTurn = useCallback(async (
    turn: number,
    history: ChatMessage[],
    signal: AbortSignal,
    workgroup: WorkgroupConfig,
    task: string // Task for the workgroup (e.g., concatenated source code + preferences)
  ) => {
    if (!isMountedRef.current || signal.aborted) {
        addWorkgroupLog({ type: 'system', message: 'Ejecución de análisis de grupo detenida.' });
        if (status === "processing_workgroup_turn") setStatus("idle"); 
        return;
    }
    addWorkgroupLog({ type: 'system', message: `Iniciando turno de análisis ${turn}/${MAX_WORKGROUP_TURNS} para el grupo ${workgroup.name}...` });
    setCurrentWorkgroupTurn(turn);
    setStatus("processing_workgroup_turn");

    const orchestratorAgent = agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
    if (!orchestratorAgent) {
        addWorkgroupLog({ type: 'error', message: 'Error crítico: Agente Orquestador no encontrado en el grupo.' });
        setCurrentAnalysisError("Orquestrador no encontrado en el grupo.");
        setStatus("error");
        return;
    }

    const orchestratorLlmOptions = resolveLlmOptionsForSource(`agent:${orchestratorAgent.id}`, agents, workgroups);
    if (!orchestratorLlmOptions) {
        addWorkgroupLog({ type: 'error', message: `Configuración LLM inválida para Orquestrador (${orchestratorAgent.name})`});
        setCurrentAnalysisError(`Configuración LLM inválida para Orquestrador.`);
        setStatus("error");
        return;
    }
    
    const participantAgentDetails = workgroup.agentIds
        .filter(id => id !== orchestratorAgent.id)
        .map(id => agents.find(a => a.id === id))
        .filter(agent => agent !== undefined) as AgentConfig[];

    const participantAgentConfigs = participantAgentDetails.reduce((acc, agent) => {
        const llmOptions = resolveLlmOptionsForSource(`agent:${agent.id}`, agents, workgroups);
        if (llmOptions) {
            acc[agent.id] = {
                id: agent.id, name: agent.name, systemMessage: agent.systemMessage,
                llmProviderId: llmOptions.providerId, llmModelName: llmOptions.modelName,
                llmApiKey: llmOptions.apiKey, llmApiUrl: llmOptions.apiUrl
            };
        }
        return acc;
    }, {} as WorkgroupTurnPayload['participantAgentConfigs']);


    const payload: WorkgroupTurnPayload = {
        workgroupName: workgroup.name, task, conversationHistory: history,
        orchestrator: {
            id: orchestratorAgent.id, name: orchestratorAgent.name, systemMessage: orchestratorAgent.systemMessage,
            llmProviderId: orchestratorLlmOptions.providerId, llmModelName: orchestratorLlmOptions.modelName,
            llmApiKey: orchestratorLlmOptions.apiKey, llmApiUrl: orchestratorLlmOptions.apiUrl
        },
        participantAgentConfigs, currentTurn: turn, maxTurns: MAX_WORKGROUP_TURNS
    };

    addWorkgroupLog({ type: 'debug', message: `Enviando payload a handleWorkgroupTurn para el turno ${turn}. Tarea (inicio): ${task.substring(0,500)}...`, llmRequest: { orchestratorModel: payload.orchestrator.llmModelName, numParticipants: Object.keys(payload.participantAgentConfigs).length, historyLength: payload.conversationHistory.length } });

    try {
        const result: WorkgroupTurnResponse = await handleWorkgroupTurn(payload);
        (result.serverLogs || []).forEach(serverLogMsg => {
             const match = serverLogMsg.match(/^\[(.*?)\] \[(.*?)\] (.*)$/);
             if (match) {
                 const [, timestamp, type, messageData] = match;
                 let message = messageData;
                 let data;
                 if(messageData.includes(' | Data: ')) {
                    [message, data] = messageData.split(' | Data: ');
                 }
                 addWorkgroupLog({ timestamp, type: type.toLowerCase() as LogEntry['type'] || 'debug', message, llmResponse: data ? {raw: data} : undefined });
             } else {
                 addWorkgroupLog({ type: 'debug', message: `[SERVER] ${serverLogMsg}` });
             }
        });

        if (result.error) {
            addWorkgroupLog({ type: 'error', message: `Error en servidor (turno ${turn}): ${result.error}` });
            setCurrentAnalysisError(result.error);
            setStatus("error");
            return;
        }
        
        const newHistory = result.updatedHistory || history;
        setWorkgroupConversationHistory(newHistory);


        if (result.orchestratorDecision) {
            const nextAgentConfig = agents.find(a => a.id === result.orchestratorDecision?.nextAgentId);
            addWorkgroupLog({ type: 'orchestrator', agentName: orchestratorAgent.name, message: `Decisión: ${result.orchestratorDecision.reason}. Próximo: ${nextAgentConfig?.name || result.orchestratorDecision.nextAgentId}`, llmResponse: {raw: result.orchestratorDecision.rawOutput} });
        }
        if (result.agentResponse) {
            const respondingAgent = agents.find(a => a.id === result.agentResponse?.agentId);
            addWorkgroupLog({ type: 'agent', agentName: respondingAgent?.name || result.agentResponse.agentId, message: `Respuesta (inicio): ${result.agentResponse.content.substring(0, 500)}...`, llmResponse: {raw: result.agentResponse.rawOutput} });
           
            // For AutoUpdate, the final response is expected to be ProjectAnalysisResponse
            if (result.isComplete || result.orchestratorDecision?.nextAgentId === "COMPLETADO") {
                try {
                    const finalAnalysis = JSON.parse(result.agentResponse.content) as ProjectAnalysisResponse;
                    if (finalAnalysis && finalAnalysis.analysisTitle && Array.isArray(finalAnalysis.suggestions)) {
                         processAnalysisResult(finalAnalysis);
                         addWorkgroupLog({ type: 'system', message: `Análisis del grupo de trabajo completado y procesado.`});
                         return; 
                    } else {
                         throw new Error("La respuesta final del agente no tiene el formato ProjectAnalysisResponse esperado.");
                    }
                } catch (parseError) {
                    addWorkgroupLog({ type: 'error', message: `Error al parsear la respuesta final del agente como JSON para ProjectAnalysisResponse: ${(parseError as Error).message}. Contenido completo en logs del servidor.`});
                    setCurrentAnalysisError("La respuesta final del grupo de trabajo no pudo ser interpretada como un análisis de proyecto válido.");
                    setStatus("error");
                    return;
                }
            }
        }

        if (result.isComplete || turn >= MAX_WORKGROUP_TURNS) {
            addWorkgroupLog({ type: 'system', message: `Ejecución del análisis de grupo ${result.isComplete ? 'marcada como completada' : 'alcanzó el límite de turnos'}.` });
             if (!analysisResult && !(result.agentResponse && result.orchestratorDecision?.nextAgentId === "COMPLETADO")) { 
                setCurrentAnalysisError("El grupo de trabajo finalizó pero no se obtuvo un resultado de análisis claro.");
                setStatus("error");
            } else {
                 setStatus("success"); 
            }
        } else if (!signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (!signal.aborted && isMountedRef.current) {
                runWorkgroupAnalysisTurn(turn + 1, newHistory, signal, workgroup, task);
            }
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido en cliente procesando turno de grupo.';
        addWorkgroupLog({ type: 'error', message: `Error en cliente (turno ${turn}): ${errorMsg}` });
        setCurrentAnalysisError(errorMsg);
        setStatus("error");
    }
  }, [addWorkgroupLog, agents, workgroups, processAnalysisResult, status, setWorkgroupConversationHistory]); // Removed analysisResult from deps

  const handleStartAutoAnalysis = async (isRetry: boolean = false) => {
    const options = resolvedLlmOptions; // For direct LLM calls
    let workgroupForAnalysis: WorkgroupConfig | undefined;

    if (selectedConfigSource.startsWith("workgroup:")) {
        const workgroupId = selectedConfigSource.split(":")[1];
        workgroupForAnalysis = workgroups.find(wg => wg.id === workgroupId);
        if (!workgroupForAnalysis) {
            toast({ title: "Error de Configuración", description: "Grupo de trabajo seleccionado no encontrado.", variant: "destructive" });
            return;
        }
    } else if (!options) { // Direct LLM call but options not resolved
        toast({
            title: "Configuración LLM Incompleta",
            description: `Configuración LLM para '${getSourceName(selectedConfigSource)}' incompleta.`,
            variant: "destructive", duration: 7000,
        });
        return;
    }

    if (!isRetry) { // Full reset for new analysis
        setDetailedLogs([]);
        setWorkgroupAnalysisLogs([]);
        setWorkgroupConversationHistory([]);
        setCurrentWorkgroupTurn(0);
    } else { // For retry, keep existing logs and append
        addDetailedLog("Reintentando análisis...", true);
    }

    setStatus("loading_source");
    setAnalysisResult(null);
    setCurrentAnalysisError(null);
    setCurrentGitError(null);
    setSuggestionsWithStatus([]);
    setAnalysisProgress({ processed: 0, total: 0 });
    setAutoFixSuggestion(null);
    addDetailedLog("Paso 1: Obteniendo código fuente de la aplicación...", true);

    toast({
      title: isRetry ? "Reintentando Auto-Análisis" : "Auto-Análisis Iniciado",
      description: `Paso 1: Cargando y preparando el código fuente...`
    });

    const bundleResult = await getApplicationSourceBundle(workgroupForAnalysis ? true : false); // Concatenate for workgroup task
    addServerLogs(bundleResult.logsBuilt);

    if (!bundleResult.success || (!bundleResult.files && !bundleResult.concatenatedSource)) {
      const errorMsg = bundleResult.error || "No se pudo obtener el código fuente para analizar.";
      addDetailedLog(`Error en Paso 1: ${errorMsg}`, true);
      handleAnalysisError(errorMsg);
      return;
    }
    if (bundleResult.files) setProjectFiles(bundleResult.files);
    addDetailedLog(`Paso 1 completado. ${bundleResult.files?.length || 'Varios'} archivos obtenidos.`, true);


    if (workgroupForAnalysis) {
        addDetailedLog(`Análisis iniciado usando el grupo de trabajo: ${workgroupForAnalysis.name}.`, true);
        setStatus("processing_workgroup_turn");
        workgroupExecutionControllerRef.current = new AbortController();

        if (!bundleResult.concatenatedSource) {
            addDetailedLog(`Error: No se pudo obtener el código fuente concatenado para el grupo de trabajo.`, true);
            setStatus("error");
            setCurrentAnalysisError("Error al obtener código fuente para el grupo.");
            return;
        }
        const taskForWorkgroup = `Analiza el siguiente código fuente completo de la aplicación CodeAlchemist. ${analysisPreferences ? `Preferencias de análisis: "${analysisPreferences}".` : ''} El código es:\n\n${bundleResult.concatenatedSource}`;
        // Make sure setWorkgroupConversationHistory is defined and passed correctly
        await runWorkgroupAnalysisTurn(1, [], workgroupExecutionControllerRef.current.signal, workgroupForAnalysis, taskForWorkgroup);

    } else if (options && bundleResult.files) { // Direct LLM call
        addDetailedLog(`Paso 2: Enviando ${bundleResult.files.length} archivos al servidor para análisis y fragmentación...`, true);
        setStatus("analyzing"); // This status indicates server-side chunking & LLM calls are next

        const analysisActionResult = await handleAutoAnalyzeAppSource(
            bundleResult.files, // Pass the obtained files
            options.providerId,
            options.apiKey,
            options.modelName,
            options.apiUrl,
            analysisPreferences
        );
        addServerLogs(analysisActionResult.detailedExecutionLogs);
        setAnalysisProgress({ processed: analysisActionResult.chunksProcessed || 0, total: analysisActionResult.totalChunks || 0 });

        if (analysisActionResult.success && analysisActionResult.data) {
            processAnalysisResult(analysisActionResult.data);
        } else {
            handleAnalysisError(analysisActionResult.error);
        }
    } else {
        // Should not be reached if logic above is correct
        const errMsg = "Error de lógica interna: No se pudo determinar el flujo de análisis.";
        addDetailedLog(errMsg, true);
        handleAnalysisError(errMsg);
    }
  };
  
  const handleAnalysisError = (errorMsg: string | undefined) => {
    setStatus("error");
    setCurrentAnalysisError(errorMsg || "Ocurrió un error desconocido durante el auto-análisis.");
    setCurrentGitError(null); // Clear Git error if it was a general analysis error
    toast({ title: "Error en Auto-Análisis", description: errorMsg || "Ocurrió un error desconocido.", variant: "destructive", duration: 10000 });
    addDetailedLog(`Error en auto-análisis: ${errorMsg || "Desconocido"}`, true);
  };


  const handleAttemptAutoFix = async (errorToFix?: string | null, errorContext?: string) => {
    const targetError = errorToFix || currentAnalysisError || currentGitError;
    const options = resolvedLlmOptions; // Use the globally resolved options for auto-fix
    if (!options) {
      toast({ title: "Configuración Faltante", description: "La configuración LLM seleccionada está incompleta para Auto-Fix.", variant: "destructive" });
      return;
    }
    if (!targetError) {
      toast({ title: "Información Faltante", description: "No hay error actual para corregir.", variant: "destructive" });
      return;
    }
    
    const currentLogs = [...detailedLogs]; // Create a mutable copy for this operation
    currentLogs.push(`[CLIENT ${new Date().toISOString()}] Intentando auto-corrección para el error: ${targetError.substring(0, 100)}... con ${options.providerId}`);
    
    const prevStatus = status;
    let fixingStatus: AutoUpdateStatus = currentGitError ? "fixing_git_error" : "fixing_error";
    setStatus(fixingStatus);
    setAutoFixSuggestion(null);
    // setDetailedLogs(currentLogs); // Update logs immediately with the attempt message
    toast({ title: "Intentando Auto-Corrección", description: `Consultando a ${options.providerId} para una posible solución...` });

    const fixResult = await handleGetErrorFixSuggestion(
      targetError, options.providerId, options.apiKey, options.modelName, options.apiUrl, currentLogs, errorContext
    );
    addServerLogs(fixResult.data?.solution_suggestions ? [fixResult.data.solution_suggestions] : fixResult.error ? [fixResult.error] : []);


    if (fixResult.success && fixResult.data) {
      setAutoFixSuggestion(fixResult.data);
      setIsAutoFixModalOpen(true);
      toast({ title: "Sugerencia de Corrección Recibida", description: `La IA (${options.providerId}) ha proporcionado una sugerencia.` });
      addDetailedLog(`Sugerencia de corrección recibida de la IA.`, true);
    } else {
      toast({ title: "Error en Auto-Corrección", description: fixResult.error || `No se pudo obtener sugerencia.`, variant: "destructive" });
      addDetailedLog(`Error al obtener sugerencia de corrección: ${fixResult.error || "Desconocido"}`, true);
    }
     // Revert status carefully
    setStatus(prevStatus === "fixing_error" || prevStatus === "fixing_git_error" 
        ? (currentAnalysisError || currentGitError ? "error" : (analysisResult ? "success" : "idle")) 
        : prevStatus);
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

    if (!suggestionToApply.area || !suggestionToApply.originalContent || !suggestionToApply.suggestedFullFileContent) {
      const missingField = !suggestionToApply.area ? "nombre de archivo" : !suggestionToApply.originalContent ? "contenido original" : "contenido sugerido";
      toast({ title: "Error de Aplicación", description: `Falta ${missingField} para ${suggestionToApply.area || 'esta sugerencia'}.`, variant: "destructive" });
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "error_applying", errorMessage: `Falta ${missingField}.` } : s));
      currentLogsCopy.push(`[CLIENT ERROR ${new Date().toISOString()}] Falta ${missingField} para sugerencia ID: ${suggestionId}`);
      setDetailedLogs(currentLogsCopy);
      return;
    }

    setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "applying" } : s));
    toast({ title: "Aplicando Sugerencia...", description: `Aplicando cambio a ${suggestionToApply.area}` });
    currentLogsCopy.push(`[CLIENT ${new Date().toISOString()}] Estado: 'applying'. Llamando a applySuggestedChange para ${suggestionToApply.area}.`);

    const baseFilePath = suggestionToApply.area.includes(" (parte ") ? suggestionToApply.area.split(" (parte ")[0] : suggestionToApply.area;
    const result = await applySuggestedChange(baseFilePath, suggestionToApply.originalContent, suggestionToApply.suggestedFullFileContent, currentLogsCopy);

    if (result.success && result.newContent !== undefined) {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "applied", originalContent: result.newContent! } : s));
      toast({ title: "Sugerencia Aplicada", description: `El cambio para ${baseFilePath} se ha aplicado.` });
      currentLogsCopy.push(`[CLIENT SUCCESS ${new Date().toISOString()}] Sugerencia aplicada a ${baseFilePath}.`);
      setProjectFiles(prevFiles => (prevFiles || []).map(pf => {
        const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
        if (normalizePath(pf.fileName.toLowerCase()) === normalizePath(baseFilePath.toLowerCase())) {
          currentLogsCopy.push(`[CLIENT DETAIL ${new Date().toISOString()}] Actualizando contenido en projectFiles para ${pf.fileName}.`);
          return { ...pf, content: result.newContent! };
        }
        return pf;
      }));
    } else {
      setSuggestionsWithStatus(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "error_applying", errorMessage: result.error } : s));
      toast({ title: "Error al Aplicar", description: result.error || `No se pudo aplicar el cambio a ${baseFilePath}.`, variant: "destructive" });
      currentLogsCopy.push(`[CLIENT ERROR ${new Date().toISOString()}] Error al aplicar sugerencia a ${baseFilePath}: ${result.error}`);
    }
    addServerLogs(result.error ? [result.error] : []); // Add error to logs if present
    setDetailedLogs(currentLogsCopy);
  };

  const handleCopyLogsToClipboard = (logContent: string[] | string | undefined) => {
    if (!logContent) return;
    const textToCopy = Array.isArray(logContent) ? logContent.join('\n') : logContent;
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast({ title: 'Copiado', description: 'El contenido ha sido copiado al portapapeles.' }))
      .catch(err => {
        console.error('Error al copiar:', err);
        toast({ title: 'Fallo al Copiar', description: 'No se pudo copiar el contenido.', variant: 'destructive' });
      });
  };
  const handleClearLogs = () => {
    setDetailedLogs(["[CLIENT INFO] Logs borrados por el usuario."]);
    setWorkgroupAnalysisLogs([]);
    toast({ title: "Logs Borrados", description: "Los logs de ejecución han sido borrados." });
  };
  const handleToggleLogsExpansion = () => setLogsExpanded(prev => !prev);

 const handleDownloadSource = async (format: 'zip' | 'json' = 'zip') => {
    setIsDownloading(true);
    let currentLogsCopy = [...detailedLogs];
    addDetailedLog(`Iniciando preparación para descarga de código fuente en formato ${format.toUpperCase()}.`, true);
    toast({ title: "Preparando Descarga", description: `Recopilando archivos fuente para formato ${format.toUpperCase()}...` });

    // Always get the latest bundle for download to reflect applied changes
    addDetailedLog(`Obteniendo el paquete de código fuente más reciente para la descarga...`, true);
    const bundleResult = await getApplicationSourceBundle(false); // getApplicationSourceBundle is a server action
    addServerLogs(bundleResult.logsBuilt);

    let filesToProcess = projectFiles; // Default to current state
    if (bundleResult.success && bundleResult.files) {
      filesToProcess = bundleResult.files;
      setProjectFiles(filesToProcess); // Update state with the latest files
      addDetailedLog(`Paquete de código fuente más reciente obtenido con ${filesToProcess.length} archivos.`, true);
    } else {
      toast({ title: "Error al Obtener Código", description: bundleResult.error || "No se pudo obtener el código fuente actualizado.", variant: "destructive" });
      setIsDownloading(false);
      addDetailedLog(`Error al obtener código para ${format.toUpperCase()}: ${bundleResult.error}`, true);
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
              currentLogsCopy.push(`[CLIENT DETAIL ${new Date().toISOString()}] Añadido al ZIP: ${file.fileName}`);
            } else {
              currentLogsCopy.push(`[CLIENT WARN ${new Date().toISOString()}] Omitido en ZIP (nombre vacío, binario o error): ${file.fileName}`);
            }
          });
          blob = await zip.generateAsync({ type: "blob" });
          downloadFileName = 'codealchemist-source.zip';
        } else { // json
          const jsonData = JSON.stringify(filesToProcess, null, 2);
          blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
          downloadFileName = 'codealchemist-source.json';
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
        addDetailedLog(`Descarga ${format.toUpperCase()} iniciada.`, true);
      } catch (e) {
        const error = e instanceof Error ? e.message : "Error desconocido";
        toast({ title: `Error al Crear Descarga ${format.toUpperCase()}`, description: `No se pudo crear el archivo ${format.toUpperCase()}: ${error}`, variant: "destructive" });
        addDetailedLog(`Error al crear ${format.toUpperCase()}: ${error}`, true);
      }
    } else {
      toast({ title: "Error al Obtener Código", description: "No se encontraron archivos para empaquetar.", variant: "destructive" });
      addDetailedLog(`Error: No se encontraron archivos para ${format.toUpperCase()}.`, true);
    }
    setIsDownloading(false);
  };

  const performGitUpload = async (isRetry: boolean = false) => {
    const { repoUrl, username, email, pat } = gitConfig;
    if (!repoUrl || !username || !email || !pat) {
      toast({ title: "Configuración Git Incompleta", description: "Completa la configuración en Ajustes.", variant: "destructive" });
      setStatus(analysisResult ? "success" : "idle");
      return;
    }
    setCurrentGitError(null);
    setCurrentAnalysisError(null); // Clear general analysis error if we are trying Git
    setStatus("uploading_git");
    
    const attemptNumber = isRetry ? gitUploadRetryCount + 1 : 1;
    if (isRetry) setGitUploadRetryCount(attemptNumber);
    
    const commitMsg = `CodeAlchemist: AutoUpdate Sync (Attempt ${attemptNumber} - ${new Date().toISOString()})`;
    addDetailedLog(`${isRetry ? `Reintentando (${attemptNumber}/${MAX_GIT_UPLOAD_RETRIES})` : 'Iniciando'} subida a Git...`, true);
    toast({ title: `${isRetry ? `Reintentando Subida Git (${attemptNumber})` : "Subiendo a Git..."}`, description: `Intentando subir a ${repoUrl.split('/').pop()?.replace('.git', ' ')}` });

    const result = await handleUploadToGit({ repoUrl, username, email, pat }, commitMsg);
    addServerLogs(result.logs);

    if (result.success) {
      toast({ title: "Subida a Git Exitosa", description: result.message, duration: 7000 });
      setGitUploadRetryCount(0); // Reset retry count on success
      setStatus(analysisResult ? "success" : "idle"); // Revert to previous relevant status
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
      setStatus("error"); // Set to general error to show Auto-Fix for Git error
    }
  };
  const handleInitialGitUpload = () => { setGitUploadRetryCount(0); performGitUpload(false); };
  const handleRetryGitUploadFromModal = () => { setIsAutoFixModalOpen(false); performGitUpload(true); };

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
  const isProcessing = ["analyzing", "loading_source", "chunking_source", "fixing_error", "uploading_git", "fixing_git_error", "processing_workgroup_turn"].includes(status);
  const isGitConfigured = gitConfig.repoUrl && gitConfig.username && gitConfig.email && gitConfig.pat;


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
            Analiza el código fuente de CodeAlchemist usando la configuración LLM seleccionada.
            {!resolvedLlmOptions && selectedConfigSource && !selectedConfigSource.startsWith("workgroup:") ? (
              <span className="text-destructive block mt-1"> (Configuración LLM para '{getSourceName(selectedConfigSource)}' incompleta)</span>
            ) : resolvedLlmOptions && !selectedConfigSource.startsWith("workgroup:") ? (
              <span className="text-foreground block mt-1">(Usando: {getSourceName(selectedConfigSource)} - {resolvedLlmOptions.providerId} - {resolvedLlmOptions.modelName})</span>
            ) : selectedConfigSource.startsWith("workgroup:") ? (
                 <span className="text-foreground block mt-1">(Usando Grupo: {getSourceName(selectedConfigSource)})</span>
            ) : (
              <span className="text-muted-foreground block mt-1">(Selecciona fuente de configuración)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="configSource" className="text-base flex items-center gap-1"><Settings2 className="h-4 w-4" /> Usar Configuración LLM De:</Label>
            <Select onValueChange={setSelectedConfigSource} value={selectedConfigSource}>
              <SelectTrigger id="configSource" className="w-full md:w-1/2"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Ajustes Globales</SelectItem>
                {agents.map(agent => <SelectItem key={`agent:${agent.id}`} value={`agent:${agent.id}`}>Agente: {agent.name}</SelectItem>)}
                {workgroups.map(wg => <SelectItem key={`workgroup:${wg.id}`} value={`workgroup:${wg.id}`}>Grupo: {wg.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {!resolvedLlmOptions && selectedConfigSource && !selectedConfigSource.startsWith("workgroup:") && (
              <p className="text-xs text-destructive mt-1">Configuración para '{getSourceName(selectedConfigSource)}' incompleta. Revisa Ajustes, Agentes o Grupos.</p>
            )}
          </div>
          <p className="text-muted-foreground">
            Al hacer clic en &quot;Iniciar Auto-Análisis&quot;, CodeAlchemist recopilará su código fuente y lo enviará
            al modelo/grupo configurado. También puedes descargar el código o subirlo a Git.
          </p>
          <div className="space-y-2">
            <Label htmlFor="analysis-preferences" className="text-base flex items-center gap-2 text-foreground"><Edit3 className="h-5 w-5" /> Preferencias de Análisis (Opcional)</Label>
            <Textarea id="analysis-preferences" value={analysisPreferences} onChange={(e) => setAnalysisPreferences(e.target.value)}
              placeholder="Ej: 'Enfócate en optimizar el rendimiento...', 'Revisa la seguridad...'" rows={3} className="bg-card text-foreground" />
            <p className="text-xs text-muted-foreground">Describe qué tipo de actualizaciones o áreas te gustaría que la IA priorizara.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => handleStartAutoAnalysis(false)} disabled={isProcessing || (!resolvedLlmOptions && !selectedConfigSource.startsWith("workgroup:"))} className="text-base py-3 px-6">
              {isProcessing && (status === "analyzing" || status === "loading_source" || status === "chunking_source" || status === "processing_workgroup_turn") ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              Iniciar Auto-Análisis
            </Button>
            <Button onClick={() => handleDownloadSource('zip')} disabled={isDownloading || projectFiles.length === 0 || isProcessing} variant="outline" className="text-base py-3 px-6 text-foreground">
              {isDownloading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DownloadCloud className="mr-2 h-5 w-5" />} Descargar Código (ZIP)
            </Button>
             <Button onClick={() => handleDownloadSource('json')} disabled={isDownloading || projectFiles.length === 0 || isProcessing} variant="outline" className="text-base py-3 px-6 text-foreground">
              {isDownloading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DownloadCloud className="mr-2 h-5 w-5" />} Descargar Código (JSON)
            </Button>
            <Button onClick={handleInitialGitUpload} disabled={!isGitConfigured || projectFiles.length === 0 || isProcessing} variant="outline" className="text-base py-3 px-6 text-foreground"
              title={!isGitConfigured ? "Configura Git en Ajustes." : "Subir código a Git"}>
              {status === "uploading_git" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GitFork className="mr-2 h-5 w-5" />} Subir a Git
            </Button>
          </div>

          {(isProcessing || status === "success" || status === "error") && (
            <div className="mt-4 space-y-2">
              <Label className="text-sm text-foreground">
                {status === "loading_source" ? "Paso 1: Cargando código fuente..." :
                 status === "chunking_source" ? "Paso 1.5: Dividiendo código en fragmentos..." :
                 status === "analyzing" ? (analysisProgress.total > 0 ? `Paso 2: Procesando fragmentos LLM... (${analysisProgress.processed}/${analysisProgress.total})` : "Paso 2: Calculando fragmentos para LLM...") :
                 status === "processing_workgroup_turn" ? `Paso 2: Procesando con grupo de trabajo... (Turno ${currentWorkgroupTurn}/${MAX_WORKGROUP_TURNS})` :
                 status === "success" ? `Operación completada ${selectedConfigSource.startsWith("workgroup:") ? `(Grupo finalizado en turno ${currentWorkgroupTurn})` : `(${analysisProgress.processed}/${analysisProgress.total} fragmentos)`}.` :
                 status === "error" && (currentAnalysisError || currentGitError) ? `Operación interrumpida.` :
                 status === "uploading_git" ? `Subiendo a Git (Intento ${gitUploadRetryCount + 1}/${MAX_GIT_UPLOAD_RETRIES})...` :
                 status === "fixing_error" ? "Intentando auto-corrección de error de análisis..." :
                 status === "fixing_git_error" ? "Intentando auto-corrección de error Git..." : "Estado desconocido"}
              </Label>
              <Progress value={
                status === "loading_source" ? 5 :
                status === "chunking_source" ? 10 :
                status === "analyzing" && analysisProgress.total === 0 ? 15 : // After chunking, before first LLM call
                status === "analyzing" && analysisProgress.total > 0 ? 15 + (analysisProgress.processed / analysisProgress.total) * 80 : // LLM calls from 15% to 95%
                status === "processing_workgroup_turn" && MAX_WORKGROUP_TURNS > 0 ? 15 + (currentWorkgroupTurn / MAX_WORKGROUP_TURNS) * 80 :
                (status === "success" || status === "error" || status === "uploading_git" || status === "fixing_error" || status === "fixing_git_error" ? 100 : 0)
              } className="w-full h-3" />
            </div>
          )}
           {(detailedLogs.length > 0 || workgroupAnalysisLogs.length > 0) && (
             <Card className="mt-6 border-primary/30">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary"><ListOrdered className="h-5 w-5" /> Logs de Ejecución</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleToggleLogsExpansion} title={logsExpanded ? "Contraer Logs" : "Expandir Logs"}>
                        {logsExpanded ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleClearLogs} title="Borrar Logs"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className={cn("p-2 border rounded bg-muted/30 transition-all duration-300 ease-in-out", logsExpanded ? "h-[500px]" : "h-[250px]")}>
                    <pre className="text-xs text-foreground whitespace-pre-wrap">
                      {detailedLogs.map((log, index) => (
                        <span key={`detail-${index}`} className={log.includes("[ERROR") || log.includes("Error:") || log.includes("Falló") ? "text-destructive" : log.includes("[WARN") ? "text-yellow-600 dark:text-yellow-400" : log.includes("[CLIENT") ? "text-muted-foreground" : ""}>{log}\n</span>
                      ))}
                      {workgroupAnalysisLogs.length > 0 && <Separator className="my-2" />}
                      {workgroupAnalysisLogs.map((log, index) => (
                        <div key={`wg-${index}`} className={cn("mb-1 p-0.5 rounded-sm", log.type === 'orchestrator' && "bg-accent/10", log.type === 'agent' && "bg-primary/5", log.type === 'error' && "bg-destructive/10 text-destructive", log.type === 'system' && "bg-muted/50 italic", log.type === 'debug' && "opacity-60")}>
                          <span className="font-mono text-muted-foreground mr-1">{log.timestamp}</span>
                          <span className={cn("font-semibold", log.type === 'orchestrator' && "text-accent", log.type === 'agent' && "text-primary", log.type === 'error' && "text-destructive", log.type === 'system' && "text-muted-foreground")}>
                            {log.type.toUpperCase()}{log.agentName ? ` (${log.agentName})` : ''}:
                          </span>
                          <span className="ml-1">{log.message}</span>
                        </div>
                      ))}
                    </pre>
                  </ScrollArea>
                  <Button variant="outline" size="sm" onClick={() => handleCopyLogsToClipboard([...detailedLogs, ...workgroupAnalysisLogs.map(l => `[${l.timestamp}] [WG-${l.type.toUpperCase()}] ${l.agentName ? `(${l.agentName}) ` : ''}${l.message}`)].join('\n'))} className="mt-2 text-foreground">
                    <Copy className="mr-2 h-4 w-4" /> Copiar Logs
                  </Button>
                </CardContent>
             </Card>
           )}

          {analysisResult && status === "success" && (
            <Card className="mt-6 border-accent bg-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2 text-accent"><FileCode className="h-6 w-6" /> {analysisResult.analysisTitle}</CardTitle>
                <CardDescription>Analizado usando la configuración de '{getSourceName(selectedConfigSource)}'.</CardDescription>
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
                                <Button variant="ghost" size="sm" onClick={() => handleCopyLogsToClipboard(s.errorMessage)} className="mt-1 h-6 px-1.5 text-xs text-destructive hover:bg-destructive/20"><Copy className="mr-1 h-3 w-3" /> Copiar Error</Button>
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
                                      <AlertDialogDescription className="text-muted-foreground">
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
                  <Button variant="outline" size="sm" onClick={() => handleCopyLogsToClipboard(currentAnalysisError || currentGitError)} className="text-destructive border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground"><Copy className="mr-2 h-4 w-4" /> Copiar Error</Button>
                  <Button variant="outline" size="sm" onClick={() => handleAttemptAutoFix(currentAnalysisError || currentGitError, currentGitError ? "Error en subida Git." : "Error en auto-análisis.")}
                    disabled={status === "fixing_error" || status === "fixing_git_error" || (!resolvedLlmOptions && !selectedConfigSource.startsWith("workgroup:"))} 
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
        <CardFooter><p className="text-xs text-muted-foreground"><strong>Nota:</strong> El análisis se realiza sobre el código completo. La descarga proporciona un ZIP. La subida a Git usa el estado actual. Revisa cuidadosamente las sugerencias de IA.</p></CardFooter>
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
