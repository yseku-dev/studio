
'use server';

import type { LLMOptions } from '@/services/groq';
import { generateProjectStructureFromPrompt as callLLMToGenerateProject } from '@/services/groq'; // Renamed import
import { GeneratedProjectResponse as GeneratedProjectLLMResponse, ProjectFile } from '@/services/groq'; // Use generic type from service
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS } from '@/config/agent-config';
import { resolveLlmOptionsForSource } from '@/lib/llm-utils';
import type { ChatMessage } from '@/services/groq';

// Re-exporting types for consistency
export type { ProjectFile }; 
export type GeneratedProjectData = GeneratedProjectLLMResponse;

export interface HandleGenerateProjectResult {
  success: boolean;
  data?: GeneratedProjectData;
  error?: string;
  workgroupLogs?: string[];
}

const LLM_API_TIMEOUT_MS_GENERATE_PROJECT = 180000; // 180 segundos para generación de proyecto

export async function handleGenerateProject(
  prompt: string,
  providerId: LLMProviderId, // Expect providerId
  apiKey: string,
  modelName: string,
  apiUrl?: string // Optional API URL for local LLMs
): Promise<HandleGenerateProjectResult> {
  
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
  
  try {
    const result = await callLLMToGenerateProject(prompt, llmOptions);
    return { success: true, data: result };
  } catch (error) {
    const operationName = `la generación del proyecto con ${currentProvider.name}`;
    console.error(`Error en ${operationName}:`, error); // Log the raw error
    
    let detailMessage: string;
    if (error instanceof Error) {
        detailMessage = error.message;
        if (detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
          detailMessage = `La generación del proyecto excedió el tiempo límite de ${LLM_API_TIMEOUT_MS_GENERATE_PROJECT / 1000} segundos. Intenta con un prompt más simple o revisa la conexión.`;
        }
    } else {
        try {
            detailMessage = String(error);
        } catch (e) {
            detailMessage = "Ocurrió un error desconocido.";
        }
    }
    if (!detailMessage && detailMessage !== '') {
        detailMessage = "Ocurrió un error desconocido.";
    } else if (detailMessage === '') {
        detailMessage = "Error sin mensaje detallado.";
    }
    
    return { success: false, error: `Falló ${operationName}: ${detailMessage}` };
  }
}


export async function initiateWorkgroupProjectGeneration(
  prompt: string,
  workgroupId: string,
  allAgents: AgentConfig[],
  allWorkgroups: WorkgroupConfig[]
): Promise<HandleGenerateProjectResult> {
  const serverLogs: string[] = [];
  const log = (type: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
    const logMsg = `[WG_GenProj-${type}] ${message}${data ? ' | Data: ' + JSON.stringify(data) : ''}`;
    console.log(logMsg);
    serverLogs.push(logMsg);
  };

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

  const orchestratorLlmOptions = resolveLlmOptionsForSource(`agent:${orchestrator.id}`, allAgents, allWorkgroups);
  if (!orchestratorLlmOptions) {
    log('ERROR', `Configuración LLM inválida para Orquestador (${orchestrator.name}) en grupo ${workgroup.name}.`);
    return { success: false, error: `Configuración LLM inválida para Orquestador.`, workgroupLogs: serverLogs };
  }

  const participantAgentConfigs = workgroup.agentIds
    .filter(id => id !== orchestrator.id)
    .map(id => allAgents.find(a => a.id === id))
    .filter(agent => agent !== undefined)
    .reduce((acc, agent) => {
      const llmOptions = resolveLlmOptionsForSource(`agent:${agent!.id}`, allAgents, allWorkgroups);
      if (llmOptions) {
        acc[agent!.id] = {
          id: agent!.id, name: agent!.name, systemMessage: agent!.systemMessage,
          llmProviderId: llmOptions.providerId, llmModelName: llmOptions.modelName,
          llmApiKey: llmOptions.apiKey, llmApiUrl: llmOptions.apiUrl
        };
      } else {
        log('ERROR', `Configuración LLM inválida para agente participante ${agent!.name}, omitiendo.`);
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
      maxTurns: MAX_WORKGROUP_TURNS
    };

    const turnResult: WorkgroupTurnResponse = await handleWorkgroupTurn(payload);
    serverLogs.push(...(turnResult.serverLogs || []).map(sl => `[Turn ${turn} ServerLog] ${sl}`));
    
    if (turnResult.error) {
      log('ERROR', `Error en el turno ${turn}: ${turnResult.error}`);
      return { success: false, error: `Error en el grupo de trabajo (turno ${turn}): ${turnResult.error}`, workgroupLogs: serverLogs };
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
            return { success: false, error: "La respuesta final del grupo no tuvo el formato esperado (falta 'projectStructure.files').", workgroupLogs: serverLogs };
          }
        } catch (e) {
          log('ERROR', `Error al parsear la respuesta final del grupo como JSON: ${(e as Error).message}`, { content: finalResponseContent });
          return { success: false, error: `Error al interpretar la respuesta final del grupo. Contenido: ${finalResponseContent.substring(0,100)}...`, workgroupLogs: serverLogs };
        }
      } else {
        log('ERROR', 'El grupo de trabajo finalizó pero no hubo respuesta de agente para extraer la estructura del proyecto.');
        return { success: false, error: "El grupo de trabajo finalizó sin generar la estructura del proyecto.", workgroupLogs: serverLogs };
      }
    }
  }

  log('ERROR', `Grupo de trabajo alcanzó el máximo de turnos (${MAX_WORKGROUP_TURNS}) sin completar la generación de proyecto.`);
  return { success: false, error: `El grupo de trabajo no completó la generación en ${MAX_WORKGROUP_TURNS} turnos.`, workgroupLogs: serverLogs };
}

