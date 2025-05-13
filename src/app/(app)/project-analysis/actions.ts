// src/app/(app)/project-analysis/actions.ts
'use server';

import { analyzeProjectSourceChunk, type ProjectAnalysisResponse, type LLMOptions } from '@/services/groq';
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AppSourceFile } from '@/types/project';
import { fetchRepositoryContents } from '@/services/git-service';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS } from '@/config/agent-config';
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

const MAX_CHARS_PER_CHUNK_PROJ_ANALYSIS = 3500;
const LLM_API_TIMEOUT_MS_PROJ_ANALYSIS = 60000 * 2; 
const INTER_CHUNK_PROCESSING_DELAY_MS_PROJ_ANALYSIS = 7000;

export async function handleAnalyzeProject(
  payload: AnalyzeProjectPayload
): Promise<AnalyzeProjectResult> {
  const serverLogs: string[] = [];
  const log = (type: 'INFO' | 'ERROR' | 'DEBUG' | 'DETAIL' | 'WARN', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    let dataString = '';
    if (data !== undefined) {
        try { dataString = ` | Data: ${JSON.stringify(data).substring(0, 300)}${JSON.stringify(data).length > 300 ? '...' : ''}`; } 
        catch { dataString = ' | Data: [Unserializable]'; }
    }
    const logMsg = `[${timestamp}] [ProjAnalysis-${type}] ${message}${dataString}`;
    console.log(logMsg.replace(/\n/g, ' ')); 
    serverLogs.push(logMsg);
  };

  try {
    log('INFO', `Iniciando análisis de proyecto completo. ConfigSource: ${payload.configSource}`);
    let projectContentToAnalyze: string | undefined = undefined;
    let sourceDescription = "";

    if (payload.gitUrl) {
      log('INFO', `Obteniendo contenido desde Git URL: ${payload.gitUrl}`);
      sourceDescription = `el repositorio Git en ${payload.gitUrl}`;
      const gitResult = await fetchRepositoryContents(payload.gitUrl);
      if (gitResult.logsBuilt) serverLogs.push(...gitResult.logsBuilt.map(l => `[GIT_FETCH_LOG] ${l}`));
      if (!gitResult.success || !gitResult.concatenatedSource) {
        log('ERROR', `No se pudo obtener el contenido del repositorio Git: ${gitResult.error}`);
        return { success: false, error: gitResult.error || "Fallo al obtener contenido de Git.", detailedExecutionLogs: serverLogs };
      }
      projectContentToAnalyze = gitResult.concatenatedSource;
      log('INFO', `Contenido Git obtenido. Tamaño: ${projectContentToAnalyze.length}`);
    } else if (payload.projectFileContent) {
      sourceDescription = `el archivo ${payload.projectFileName || 'subido'}`;
      log('INFO', `Procesando contenido de archivo: ${payload.projectFileName} (${payload.projectFileType})`);
      projectContentToAnalyze = payload.projectFileContent;
      if (!projectContentToAnalyze) {
        log('ERROR', `Contenido de archivo no proporcionado.`);
        return { success: false, error: "Contenido de archivo no proporcionado.", detailedExecutionLogs: serverLogs };
      }
      log('INFO', `Contenido de archivo procesado. Tamaño: ${projectContentToAnalyze.length}`);
    }

    if (!projectContentToAnalyze) {
      log('ERROR', 'Fuente de proyecto no especificada o no procesable.');
      return { success: false, error: "Fuente de proyecto no especificada.", detailedExecutionLogs: serverLogs };
    }

    const agentsForLookup = payload.agents || [];
    const workgroupsForLookup = payload.workgroups || [];

    if (payload.configSource.startsWith('workgroup:')) {
      const workgroupId = payload.configSource.split(':')[1];
      const workgroup = workgroupsForLookup.find(wg => wg.id === workgroupId);
      if (!workgroup || !payload.localStorageSnapshot) {
        log('ERROR', `Grupo de trabajo ${workgroupId} no encontrado o falta snapshot de localStorage.`);
        return { success: false, error: `Grupo ${workgroupId} no encontrado o config. incompleta.`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
      }

      const orchestrator = agentsForLookup.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
      if (!orchestrator) {
        log('ERROR', `Orquestador no encontrado en grupo ${workgroup.name}.`);
        return { success: false, error: `Orquestador no encontrado en grupo ${workgroup.name}.`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
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

      const taskForWorkgroup = `Analiza exhaustivamente ${sourceDescription}. Identifica áreas clave, posibles mejoras, bugs, vulnerabilidades de seguridad, y ofrece una evaluación general. Preferencias de análisis: ${payload.analysisPreferences || 'Generales'}.
  El proyecto (contenido textual):
  ${projectContentToAnalyze.substring(0, 25000)} ${projectContentToAnalyze.length > 25000 ? "\n... (contenido truncado para el prompt)" : ""}
  La respuesta final DEBE ser un objeto JSON con el formato de ProjectAnalysisResponse: { "analysisTitle": "string", "identifiedAreas": ["string"], "suggestions": [{ "area": "string", "suggestion": "string", "priority": "string", "suggestedFullFileContent": "string?" }], "overallAssessment": "string" }.`;
      
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
          return { success: false, error: `Error en turno ${turn} del grupo: ${turnResult.error}`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
        }
        
        currentHistory = turnResult.updatedHistory;
        if (turnResult.isComplete || turnResult.orchestratorDecision?.nextAgentId === "COMPLETADO") {
          log('INFO', `Grupo de trabajo completó el análisis de proyecto en el turno ${turn}.`);
          const finalResponseContent = turnResult.agentResponse?.content || currentHistory.findLast(m => m.role === 'assistant')?.content;
          if (finalResponseContent) {
            try {
              const cleanedContent = finalResponseContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              const parsedData = JSON.parse(cleanedContent) as ProjectAnalysisResponse;
              if (parsedData && typeof parsedData.analysisTitle === 'string' && Array.isArray(parsedData.suggestions)) {
                  return { success: true, data: parsedData, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
              }
              throw new Error("Respuesta final del grupo no tuvo el formato esperado (ProjectAnalysisResponse).");
            } catch (e) {
              log('ERROR', `Error al interpretar la respuesta final del grupo: ${(e as Error).message}. Contenido: ${finalResponseContent.substring(0,200)}...`);
              return { success: false, error: `Error al interpretar respuesta final: ${(e as Error).message}`, workgroupLogs: serverLogs, detailedExecutionLogs: serverLogs };
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

      const chunks: string[] = [];
      let currentChunk = "";
      const lines = projectContentToAnalyze.split('\n');
      for (const line of lines) {
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
                  `Análisis de fragmento ${i+1} de ${chunks.length} para ${sourceDescription}. Preferencias: ${payload.analysisPreferences || 'Generales'}. La respuesta debe ser en formato ProjectAnalysisResponse.`
              );
              allResults.push(result);
              if (i < chunks.length - 1) {
                  log('INFO', `Esperando ${INTER_CHUNK_PROCESSING_DELAY_MS_PROJ_ANALYSIS / 1000}s antes del siguiente fragmento.`);
                  await new Promise(resolve => setTimeout(resolve, INTER_CHUNK_PROCESSING_DELAY_MS_PROJ_ANALYSIS));
              }
          } catch (e) {
              log('ERROR', `Error analizando fragmento ${i + 1}: ${(e as Error).message}`);
              return { success: false, error: `Error en fragmento ${i+1}: ${(e as Error).message}`, detailedExecutionLogs: serverLogs };
          }
      }
      
      const aggregatedResult: ProjectAnalysisResponse = {
          analysisTitle: `Análisis Agregado de ${sourceDescription} (${chunks.length} fragmentos)`,
          identifiedAreas: Array.from(new Set(allResults.flatMap(r => r.identifiedAreas || []))),
          suggestions: allResults.flatMap(r => (r.suggestions || [])),
          overallAssessment: allResults.map(r => r.overallAssessment || "").filter(a => a.trim() !== "").join('\n\n---\n\n') || "Evaluación general no disponible.",
      };
      log('INFO', `Análisis directo de todos los fragmentos completado.`);
      return { success: true, data: aggregatedResult, detailedExecutionLogs: serverLogs };
    }
  } catch (e) {
    const error = e as Error;
    log('ERROR', `Error crítico en handleAnalyzeProject: ${error.message}`, {stack: error.stack});
    return {
      success: false,
      error: `Error crítico durante el análisis del proyecto: ${error.message}`,
      detailedExecutionLogs: serverLogs
    };
  }
}

