// src/app/(app)/generate-project/actions.ts
'use server';

import type { LLMOptions } from '@/services/groq';
import { generateProjectStructureFromPrompt as callLLMToGenerateProject } from '@/services/groq'; 
import { type GeneratedProjectResponse as GeneratedProjectLLMResponse, type ProjectFile } from '@/services/groq'; 
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AgentConfig, WorkgroupConfig, AgentLLMConfig } from '@/types/agent';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS } from '@/config/agent-config';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import type { ChatMessage } from '@/services/groq';


export type { ProjectFile }; 
export type GeneratedProjectData = GeneratedProjectLLMResponse;

export interface HandleGenerateProjectResult {
  success: boolean;
  data?: GeneratedProjectData;
  error?: string;
  workgroupLogs?: string[];
}

const LLM_API_TIMEOUT_MS_GENERATE_PROJECT = 180000; 

export async function handleGenerateProject(
  prompt: string,
  providerId: LLMProviderId, 
  apiKey: string,
  modelName: string,
  apiUrl?: string 
): Promise<HandleGenerateProjectResult> {
  try {
    const currentProvider = LLM_PROVIDERS.find(p => p.id === providerId);
    if (!currentProvider) {
      return { success: false, error: `Proveedor LLM '${providerId}' no encontrado. Por favor, configúralo en ajustes.` };
    }
    if (currentProvider.requiresApiKey && !apiKey) {
      return { success: false, error: `La clave API para ${currentProvider.name} es obligatoria. Por favor, configúrala en ajustes.` };
    }
    if (!modelName) {
      return { success: false, error: `El nombre del modelo para ${currentProvider.name} es obligatorio. Por favor, configúralo en ajustes.` };
    }

    const llmOptions: LLMOptions = {
      providerId: currentProvider.id,
      apiKey,
      modelName,
      apiUrl: apiUrl || currentProvider.apiUrl,
      timeoutMs: LLM_API_TIMEOUT_MS_GENERATE_PROJECT,
    };
    
    const operationName = `la generación del proyecto con ${currentProvider.name}`;
    const result = await callLLMToGenerateProject(prompt, llmOptions);
    return { success: true, data: result };
  } catch (error) {
    const err = error as Error;
    console.error(`Error en handleGenerateProject: ${err.message}`, {stack: err.stack}); 
    
    let detailMessage: string = err.message;
    if (detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
      detailMessage = `La generación del proyecto excedió el tiempo límite de ${LLM_API_TIMEOUT_MS_GENERATE_PROJECT / 1000} segundos. Intenta con un prompt más simple o revisa la conexión.`;
    } else if (!detailMessage || detailMessage.trim() === "") {
        detailMessage = "Ha ocurrido un error desconocido durante la operación.";
    }
    
    return { success: false, error: `Falló la generación de proyecto: ${detailMessage}` };
  }
}


export async function initiateWorkgroupProjectGeneration(
  prompt: string,
  workgroupId: string,
  allAgents: AgentConfig[],
  allWorkgroups: WorkgroupConfig[],
  localStorageSnapshot: LocalStorageSnapshot 
): Promise<HandleGenerateProjectResult> {
  const serverLogs: string[] = [];
  const log = (type: 'INFO' | 'ERROR' | 'DEBUG' | 'WARN', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    let dataStringForLogMessage = '';
    if (data !== undefined) {
        try {
            const dataPreview = (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean' || data === null)
                ? String(data)
                : JSON.stringify(data);
            dataStringForLogMessage = ` | Data: ${dataPreview.substring(0, 300)}${dataPreview.length > 300 ? '...' : ''}`;
        } catch (e) {
            dataStringForLogMessage = ' | Data: [Contenido no serializable para vista previa del log]';
            console.warn(`[GENPROJ_WG_LOG_SERIALIZATION_ERROR][${timestamp}] Failed to stringify data for log type ${type}, message: ${message}`, e);
        }
    }
    const logMsg = `[${timestamp}] [WG_GenProj-${type}] ${message}${dataStringForLogMessage}`;
    console.log(`[${timestamp}] [WG_GenProj-${type}] ${message}`, data);
    serverLogs.push(logMsg);
  };

  try {
    log('INFO', `Iniciando generación de proyecto con grupo de trabajo ID: ${workgroupId}`);
    
    const workgroup = allWorkgroups.find(wg => wg.id === workgroupId);
    if (!workgroup) {
      log('ERROR', `Grupo de trabajo con ID ${workgroupId} no encontrado.`);
      return { success: false, error: `Grupo de trabajo no encontrado.`, workgroupLogs: serverLogs };
    }

    const orchestrator = allAgents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
    if (!orchestrator) {
      log('ERROR', `Agente Orquestador no encontrado en el grupo ${workgroup.name}.`);
      return { success: false, error: `Orquestador no encontrado en el grupo.`, workgroupLogs: serverLogs };
    }

    const orchestratorLlmOptions = resolveLlmOptionsForSource(`agent:${orchestrator.id}`, allAgents, allWorkgroups, localStorageSnapshot);
    if (!orchestratorLlmOptions) {
      log('ERROR', `Configuración LLM inválida para Orquestador (${orchestrator.name}) en grupo ${workgroup.name}.`);
      return { success: false, error: `Configuración LLM inválida para Orquestador.`, workgroupLogs: serverLogs };
    }
    orchestratorLlmOptions.providerId = (orchestrator.llmConfig !== 'default' ? orchestrator.llmConfig.providerId : orchestratorLlmOptions.providerId);
    orchestratorLlmOptions.modelName = (orchestrator.llmConfig !== 'default' ? orchestrator.llmConfig.modelName : orchestratorLlmOptions.modelName);
    orchestratorLlmOptions.apiKey = (orchestrator.llmConfig !== 'default' ? orchestrator.llmConfig.apiKey : orchestratorLlmOptions.apiKey) || '';
    orchestratorLlmOptions.apiUrl = (orchestrator.llmConfig !== 'default' ? orchestrator.llmConfig.apiUrl : orchestratorLlmOptions.apiUrl);


    const participantAgentConfigs = workgroup.agentIds
      .filter(id => id !== orchestrator.id)
      .map(id => allAgents.find(a => a.id === id))
      .filter(agent => agent !== undefined)
      .reduce((acc, agent) => {
        const llmOptions = resolveLlmOptionsForSource(`agent:${agent!.id}`, allAgents, allWorkgroups, localStorageSnapshot);
        if (llmOptions) {
          acc[agent!.id] = {
            id: agent!.id, name: agent!.name, systemMessage: agent!.systemMessage,
            llmProviderId: llmOptions.providerId, llmModelName: llmOptions.modelName,
            llmApiKey: llmOptions.apiKey, llmApiUrl: llmOptions.apiUrl
          };
        } else {
          log('WARN', `Configuración LLM inválida para agente participante ${agent!.name}, será omitido.`);
        }
        return acc;
      }, {} as WorkgroupTurnPayload['participantAgentConfigs']);

    let conversationHistory: ChatMessage[] = [];
    const taskForWorkgroup = `Genera una estructura de proyecto basada en la siguiente descripción. Tu respuesta final (probablemente de un agente DesarrolladorSoftware o ArquitectoSoftware) DEBE ser un objeto JSON que coincida con la estructura de GeneratedProjectData (claves "projectStructure" con "projectName" y "files" (array de {path, content}), y opcionalmente "notes"). Descripción del usuario: "${prompt}"`;

    for (let turn = 1; turn <= MAX_WORKGROUP_TURNS; turn++) {
      log('INFO', `Procesando turno ${turn}/${MAX_WORKGROUP_TURNS} para la generación de proyecto.`);
      const payload: WorkgroupTurnPayload = {
        workgroupName: workgroup.name,
        task: taskForWorkgroup,
        conversationHistory,
        orchestrator: {
          id: orchestrator.id, name: orchestrator.name, systemMessage: orchestrator.systemMessage,
          llmProviderId: orchestratorLlmOptions.providerId, llmModelName: orchestratorLlmOptions.modelName,
          llmApiKey: orchestratorLlmOptions.apiKey, llmApiUrl: orchestratorLlmOptions.apiUrl
        },
        participantAgentConfigs,
        currentTurn: turn,
        maxTurns: MAX_WORKGROUP_TURNS,
        localStorageSnapshot, 
      };

      const turnResult: WorkgroupTurnResponse = await handleWorkgroupTurn(payload);
      serverLogs.push(...(turnResult.serverLogs || []).map(sl => `[Turn ${turn} ServerLog] ${sl}`));
      
      if (turnResult.error) {
        throw new Error(`Error en turno ${turn} del grupo: ${turnResult.error}`);
      }

      conversationHistory = turnResult.updatedHistory;

      if (turnResult.isComplete || turnResult.orchestratorDecision?.nextAgentId === "COMPLETADO") {
        log('INFO', `Grupo de trabajo completó la generación de proyecto en el turno ${turn}.`);
        const finalResponseContent = turnResult.agentResponse?.content || conversationHistory.findLast(m => m.role === 'assistant')?.content;
        if (finalResponseContent) {
          try {
            const cleanedContent = finalResponseContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsedData = JSON.parse(cleanedContent) as GeneratedProjectData;
            if (parsedData.projectStructure && Array.isArray(parsedData.projectStructure.files)) {
              return { success: true, data: parsedData, workgroupLogs: serverLogs };
            } else {
              log('ERROR', 'Respuesta final del grupo no contenía "projectStructure.files" como array.', parsedData);
              throw new Error("La respuesta final del grupo no tuvo el formato esperado (falta 'projectStructure.files').");
            }
          } catch (e) {
            log('ERROR', `Error al parsear la respuesta final del grupo como JSON: ${(e as Error).message}`, { content: finalResponseContent });
            throw new Error(`Error al interpretar la respuesta final del grupo. Contenido: ${finalResponseContent.substring(0,100)}...`);
          }
        } else {
          log('ERROR', 'El grupo de trabajo finalizó pero no hubo respuesta de agente para extraer la estructura del proyecto.');
          throw new Error("El grupo de trabajo finalizó sin generar la estructura del proyecto.");
        }
      }
    }
    throw new Error(`Grupo no completó la generación en ${MAX_WORKGROUP_TURNS} turnos.`);
  } catch (error) {
    const err = error as Error;
    let detailMessage: string = err.message;
    if (!detailMessage || detailMessage.trim() === "") {
        detailMessage = "Ha ocurrido un error desconocido durante la generación de proyecto por grupo.";
    }
    log('ERROR', `Error en initiateWorkgroupProjectGeneration: ${detailMessage}`, {stack: err.stack});
    return { success: false, error: detailMessage, workgroupLogs: serverLogs };
  }
}

