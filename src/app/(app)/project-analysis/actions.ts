
// src/app/(app)/project-analysis/actions.ts
'use server';

import { analyzeProjectSourceChunk, type ProjectAnalysisResponse, type LLMOptions } from '@/services/groq';
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AppSourceFile } from '@/types/project';
import { fetchRepositoryContents } from '@/services/git-service';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS, REFACTOR_AGENT_NAME } from '@/config/agent-config';
import type { ChatMessage } from '@/services/groq';

export interface AnalyzeProjectPayload {
  projectFileContent?: string;
  projectFileName?: string;
  projectFileType?: string;
  gitUrl?: string;
  analysisPreferences?: string;
  configSource: string;
  llmOptions?: LLMOptions;
  agents?: AgentConfig[];
  workgroups?: WorkgroupConfig[];
  localStorageSnapshot?: LocalStorageSnapshot;
}

export interface AnalyzeProjectResult {
  success: boolean;
  data?: ProjectAnalysisResponse;
  error?: string;
  workgroupLogs?: string[];
  detailedExecutionLogs?: string[];
}

const MAX_CHARS_PER_CHUNK_PROJ_ANALYSIS = 7000; // Increased chunk size for project analysis as it might be more holistic
const LLM_API_TIMEOUT_MS_PROJ_ANALYSIS = 120000; // 2 minutes
const INTER_CHUNK_PROCESSING_DELAY_MS_PROJ_ANALYSIS = 5000; // 5 seconds

export async function handleAnalyzeProject(
  payload: AnalyzeProjectPayload
): Promise<AnalyzeProjectResult> {
  const serverLogs: string[] = [];
  const log = (type: 'INFO' | 'ERROR' | 'DEBUG' | 'DETAIL' | 'WARN', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    let dataStringForLogMessage = '';
    if (data !== undefined) {
        try {
            let dataPreviewString = '';
            if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean' || data === null) {
                dataPreviewString = String(data);
            } else if (data instanceof Error) {
                dataPreviewString = `Error: ${data.message}${data.stack ? `\nStack: ${data.stack}` : ''}`;
            } else {
                dataPreviewString = JSON.stringify(data);
            }
            dataStringForLogMessage = ` | Data: ${dataPreviewString.substring(0, 300)}${dataPreviewString.length > 300 ? '...' : ''}`;
        } catch (e) {
            dataStringForLogMessage = ' | Data: [Contenido no serializable para vista previa del log]';
            console.warn(`[PROJANALYSIS_LOG_SERIALIZATION_ERROR][${timestamp}] Failed to stringify data for log type ${type}, message: ${message}`, e);
        }
    }
    const logMsg = `[${timestamp}] [ProjAnalysis-${type}] ${message}${dataStringForLogMessage}`;
    console.log(logMsg.replace(/\n/g, ' '));
    serverLogs.push(logMsg);
  };

  try {
    log('INFO', `Iniciando análisis de proyecto completo. ConfigSource: ${payload.configSource}`);
    let projectContentToAnalyze: string | undefined = undefined;
    let sourceDescription = "";
    const agentsForLookup = payload.agents || [];
    const workgroupsForLookup = payload.workgroups || [];


    if (payload.gitUrl) {
      log('INFO', `Fuente Git: ${payload.gitUrl}. Se pasará la URL al agente/grupo para que obtenga el contenido.`);
      sourceDescription = `el repositorio Git en ${payload.gitUrl}`;
      projectContentToAnalyze = payload.gitUrl; // Pass URL for agent/group to handle fetching
    } else if (payload.projectFileContent) {
      sourceDescription = `el archivo ${payload.projectFileName || 'subido'}`;
      log('INFO', `Procesando contenido de archivo: ${payload.projectFileName} (${payload.projectFileType})`);
      if (payload.projectFileType?.includes('zip') && payload.projectFileContent?.startsWith('Contenido_ZIP_Placeholder')) {
         log('WARN', 'El contenido del ZIP es un placeholder. El análisis se basará en el nombre y tipo si el LLM/agente no puede procesar ZIPs directamente.');
         projectContentToAnalyze = `Analizar el proyecto contenido en el archivo ZIP llamado '${payload.projectFileName}'. Tipo: ${payload.projectFileType}. Considera una estructura típica para este tipo de archivo.`;
      } else if (payload.projectFileType?.includes('json')) {
         try {
            const parsedJson = JSON.parse(payload.projectFileContent);
            projectContentToAnalyze = JSON.stringify(parsedJson, null, 2); // Re-stringify for consistent formatting
            log('INFO', `Contenido JSON parseado y re-formateado. Tamaño: ${projectContentToAnalyze.length}`);
         } catch (e) {
            log('ERROR', `Error al parsear archivo JSON '${payload.projectFileName}'. Se analizará como texto plano.`, e);
            projectContentToAnalyze = payload.projectFileContent;
         }
      } else {
        projectContentToAnalyze = payload.projectFileContent;
      }

      if (!projectContentToAnalyze) {
        log('ERROR', `Contenido de archivo no proporcionado o vacío.`);
        return { success: false, error: "Contenido de archivo no proporcionado.", detailedExecutionLogs: serverLogs };
      }
      log('INFO', `Contenido de archivo preparado para análisis. Tamaño (o descripción): ${projectContentToAnalyze.length}`);
    }


    if (!projectContentToAnalyze) {
      log('ERROR', 'Fuente de proyecto no especificada o no procesable.');
      return { success: false, error: "Fuente de proyecto no especificada.", detailedExecutionLogs: serverLogs };
    }

    if (payload.configSource.startsWith('workgroup:')) {
      const workgroupId = payload.configSource.split(':')[1];
      const workgroup = workgroupsForLookup.find(wg => wg.id === workgroupId);
      if (!workgroup || !payload.localStorageSnapshot) {
        log('ERROR', `Grupo de trabajo ${workgroupId} no encontrado o falta snapshot de localStorage.`);
        return { success: false, error: `Grupo ${workgroupId} no encontrado o config. incompleta.`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
      }

      const orchestrator = agentsForLookup.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
      if (!orchestrator) {
        log('ERROR', `Orquestrador no encontrado en grupo ${workgroup.name}.`);
        return { success: false, error: `Orquestrador no encontrado en grupo ${workgroup.name}.`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
      }

      const orchestratorLlmOptions = resolveLlmOptionsForSource(`agent:${orchestrator.id}`, agentsForLookup, workgroupsForLookup, payload.localStorageSnapshot);
      if (!orchestratorLlmOptions) {
          log('ERROR', `Configuración LLM inválida para Orquestrador (${orchestrator.name}).`);
          return { success: false, error: `Config. LLM inválida para Orquestrador.`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
      }
      orchestratorLlmOptions.providerId = (orchestrator.llmConfig !== 'default' ? orchestrator.llmConfig.providerId : orchestratorLlmOptions.providerId);
      orchestratorLlmOptions.modelName = (orchestrator.llmConfig !== 'default' ? orchestrator.llmConfig.modelName : orchestratorLlmOptions.modelName);
      orchestratorLlmOptions.apiKey = (orchestrator.llmConfig !== 'default' ? orchestrator.llmConfig.apiKey : orchestratorLlmOptions.apiKey) || '';
      orchestratorLlmOptions.apiUrl = (orchestrator.llmConfig !== 'default' ? orchestrator.llmConfig.apiUrl : orchestratorLlmOptions.apiUrl);


      const participantAgentConfigs = workgroup.agentIds
        .filter(id => id !== orchestrator.id)
        .map(id => agentsForLookup.find(a => a.id === id))
        .filter(agent => agent !== undefined)
        .reduce((acc, agent) => {
          const llmOpt = resolveLlmOptionsForSource(`agent:${agent!.id}`, agentsForLookup, workgroupsForLookup, payload.localStorageSnapshot!);
          if (llmOpt) {
            acc[agent!.id] = { id: agent!.id, name: agent!.name, systemMessage: agent!.systemMessage, llmProviderId: llmOpt.providerId, llmModelName: llmOpt.modelName, llmApiKey: llmOpt.apiKey, llmApiUrl: llmOpt.apiUrl };
          }
          return acc;
        }, {} as WorkgroupTurnPayload['participantAgentConfigs']);

      let taskForWorkgroup = `Analiza exhaustivamente ${sourceDescription}.`;
      if (payload.gitUrl) {
          taskForWorkgroup += ` Debes obtener el contenido del repositorio Git desde la URL: ${payload.gitUrl}. Asegúrate de que el agente responsable (probablemente ${REFACTOR_AGENT_NAME} o uno con capacidad Git) realice esta acción primero.`;
      } else {
          taskForWorkgroup += ` El contenido del proyecto es (o representa):\n${projectContentToAnalyze.substring(0, 10000)} ${projectContentToAnalyze.length > 10000 ? "\n... (contenido truncado para el prompt)" : ""}`;
      }
      taskForWorkgroup += `\nIdentifica áreas clave, posibles mejoras, bugs, vulnerabilidades de seguridad, y ofrece una evaluación general. Preferencias de análisis: ${payload.analysisPreferences || 'Generales, con foco en buenas prácticas y mantenibilidad.'}.
La respuesta final DEBE ser un objeto JSON con el formato de ProjectAnalysisResponse: { "analysisTitle": "string", "identifiedAreas": ["string"], "suggestions": [{ "area": "string", "suggestion": "string", "priority": "string", "suggestedFullFileContent": "string?" }], "overallAssessment": "string" }. Todas las descripciones y sugerencias deben estar en castellano.`;

      let currentHistory: ChatMessage[] = [];
      for (let turn = 1; turn <= MAX_WORKGROUP_TURNS; turn++) {
        log('INFO', `Procesando turno de grupo ${turn}/${MAX_WORKGROUP_TURNS} para análisis de proyecto.`);
        const turnPayload: WorkgroupTurnPayload = {
            workgroupName: workgroup.name, task: taskForWorkgroup, conversationHistory: currentHistory,
            orchestrator: {
                id: orchestrator.id, name: orchestrator.name, systemMessage: orchestrator.systemMessage,
                llmProviderId: orchestratorLlmOptions.providerId, llmModelName: orchestratorLlmOptions.modelName,
                llmApiKey: orchestratorLlmOptions.apiKey, llmApiUrl: orchestratorLlmOptions.apiUrl,
            },
            participantAgentConfigs, currentTurn: turn, maxTurns: MAX_WORKGROUP_TURNS,
            localStorageSnapshot: payload.localStorageSnapshot,
        };
        const turnResult = await handleWorkgroupTurn(turnPayload);
        if (turnResult.serverLogs) serverLogs.push(...turnResult.serverLogs);
        if (turnResult.error) {
          log('ERROR', `Error en turno ${turn} del grupo: ${turnResult.error}`);
          return { success: false, error: `Error en turno ${turn} del grupo: ${String(turnResult.error)}`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
        }

        currentHistory = result.updatedHistory || currentHistory; // Ensure history is updated
        if (result.isComplete || result.orchestratorDecision?.nextAgentId === "COMPLETADO") {
          log('INFO', `Grupo de trabajo completó el análisis de proyecto en el turno ${turn}.`);
          const finalResponseContent = result.agentResponse?.content || currentHistory.findLast(m => m.role === 'assistant')?.content;
          if (finalResponseContent) {
            try {
              const cleanedContent = finalResponseContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              const parsedData = JSON.parse(cleanedContent) as ProjectAnalysisResponse;
              if (parsedData && typeof parsedData.analysisTitle === 'string' && Array.isArray(parsedData.suggestions)) {
                  return { success: true, data: parsedData, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
              }
              throw new Error("Respuesta final del grupo no tuvo el formato esperado (ProjectAnalysisResponse).");
            } catch (e) {
              log('ERROR', `Error al interpretar la respuesta final del grupo: ${(e as Error).message}. Contenido: ${finalResponseContent.substring(0,200)}...`, e);
              return { success: false, error: `Error al interpretar respuesta final: ${String((e as Error).message)}`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
            }
          }
          return { success: false, error: "Grupo finalizó sin respuesta de agente para extraer análisis.", workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
        }
      }
      return { success: false, error: `Análisis con grupo no produjo resultado después de ${MAX_WORKGROUP_TURNS} turnos.`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
    } else {
      const llmOptionsToUse = payload.llmOptions || resolveLlmOptionsForSource(payload.configSource, agentsForLookup, workgroupsForLookup, payload.localStorageSnapshot);
      if (!llmOptionsToUse) {
        log('ERROR', `Configuración LLM no resuelta para ${payload.configSource}.`);
        return { success: false, error: `Config. LLM no resuelta.`, detailedExecutionLogs: serverLogs };
      }

      // Handle direct LLM call (chunking logic might be needed if projectContentToAnalyze is very large)
      // This part assumes projectContentToAnalyze is manageable for a single LLM call or that analyzeProjectSourceChunk can handle it.
      // If projectContentToAnalyze is a Git URL here, it means it wasn't a workgroup source,
      // so the direct LLM call needs to be smart enough or we need to fetch content first.
      // For simplicity with the current structure, if it's a Git URL and not a workgroup, we'll fetch it first.
      let contentForDirectAnalysis = projectContentToAnalyze;
      if (payload.gitUrl) {
         log('INFO', `Obteniendo contenido desde Git URL para análisis directo: ${payload.gitUrl}`);
         const gitResult = await fetchRepositoryContents(payload.gitUrl);
         if (gitResult.logsBuilt) serverLogs.push(...gitResult.logsBuilt.map(l => `[GIT_FETCH_LOG] ${l}`));
         if (!gitResult.success || !gitResult.concatenatedSource) {
            log('ERROR', `No se pudo obtener el contenido del repositorio Git para análisis directo: ${gitResult.error}`, gitResult);
            return { success: false, error: String(gitResult.error || "Fallo al obtener contenido de Git para análisis directo."), detailedExecutionLogs: serverLogs };
         }
         contentForDirectAnalysis = gitResult.concatenatedSource;
         log('INFO', `Contenido Git obtenido para análisis directo. Tamaño: ${contentForDirectAnalysis.length}`);
      }


      if (contentForDirectAnalysis.length > 300000) { // Example limit for direct analysis
          log('ERROR', `El contenido del proyecto es demasiado grande (${(contentForDirectAnalysis.length / 1024).toFixed(0)}KB) para el análisis directo. Intente con un proyecto más pequeño o use un grupo de trabajo si está configurado para manejar entradas grandes.`);
          return { success: false, error: `El contenido del proyecto es demasiado grande (${(contentForDirectAnalysis.length / 1024).toFixed(0)}KB) para el análisis directo. Intente con un proyecto más pequeño o use un grupo de trabajo si está configurado para manejar entradas grandes.`, detailedExecutionLogs: serverLogs };
      }


      const chunks: string[] = [];
      let currentChunk = "";
      const lines = contentForDirectAnalysis.split('\n');
      for (const line of lines) {
          // Add a file marker if the line looks like one, to preserve context for the LLM
          const fileMarkerMatch = line.match(/^\/\/\s*---\s*Archivo:\s*(.*?)\s*---/);
          const lineWithMarker = fileMarkerMatch ? `\n\n// --- Archivo: ${fileMarkerMatch[1]} ---\n\n${line}` : line;

          if (currentChunk.length + lineWithMarker.length + 1 > MAX_CHARS_PER_CHUNK_PROJ_ANALYSIS) {
              if (currentChunk) chunks.push(currentChunk);
              currentChunk = lineWithMarker;
          } else {
              currentChunk += (currentChunk ? '\n' : '') + lineWithMarker;
          }
      }
      if (currentChunk) chunks.push(currentChunk);
      log('INFO', `Proyecto dividido en ${chunks.length} fragmentos para análisis directo.`);

      const allResults: ProjectAnalysisResponse[] = [];
      for (let i = 0; i < chunks.length; i++) {
          log('INFO', `Analizando fragmento ${i + 1}/${chunks.length}.`);
          try {
              const result = await analyzeProjectSourceChunk(
                  chunks[i],
                  { ...llmOptionsToUse, timeoutMs: LLM_API_TIMEOUT_MS_PROJ_ANALYSIS },
                  `Análisis de fragmento ${i+1} de ${chunks.length} para ${sourceDescription}. Preferencias: ${payload.analysisPreferences || 'Generales, con foco en buenas prácticas y mantenibilidad.'}. La respuesta debe ser en formato ProjectAnalysisResponse. Todas las descripciones y sugerencias deben estar en castellano.`
              );
              allResults.push(result);
              if (i < chunks.length - 1) {
                  log('INFO', `Esperando ${INTER_CHUNK_PROCESSING_DELAY_MS_PROJ_ANALYSIS / 1000}s antes del siguiente fragmento.`);
                  await new Promise(resolve => setTimeout(resolve, INTER_CHUNK_PROCESSING_DELAY_MS_PROJ_ANALYSIS));
              }
          } catch (e) {
              log('ERROR', `Error analizando fragmento ${i + 1}: ${(e as Error).message}`, e);
              return { success: false, error: `Error en fragmento ${i+1}: ${String((e as Error).message)}`, detailedExecutionLogs: serverLogs };
          }
      }

      const aggregatedResult: ProjectAnalysisResponse = {
          analysisTitle: `Análisis Agregado de ${sourceDescription} (${chunks.length} fragmentos)`,
          identifiedAreas: Array.from(new Set(allResults.flatMap(r => r.identifiedAreas || []))),
          suggestions: allResults.flatMap(r => (r.suggestions || [])),
          overallAssessment: allResults.map(r => r.overallAssessment || "").filter(a => a.trim() !== "").join('\n\n---\n\n') || "Evaluación general no disponible.",
      };
      log('INFO', `Análisis directo de todos los fragmentos completado.`, aggregatedResult);
      return { success: true, data: aggregatedResult, detailedExecutionLogs: serverLogs };
    }
  } catch (e) {
    const error = e as Error;
    log('ERROR', `Error crítico en handleAnalyzeProject: ${error.message}`, {stack: error.stack});
    return {
      success: false,
      error: `Error crítico durante el análisis del proyecto: ${String(error.message || "Error desconocido.")}`,
      detailedExecutionLogs: serverLogs
    };
  }
}
