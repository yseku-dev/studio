// src/app/(app)/chat/actions.ts
'use server';

import type { LLMOptions, ChatMessage, ChatLLMPayload, ChatLLMResponse as ChatResponse } from '@/services/groq';
import { chatWithLLM } from '@/services/groq'; 
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AgentConfig, WorkgroupConfig, AgentLLMConfig } from '@/types/agent';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS } from '@/config/agent-config';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';

export interface ChatCompletionResponse {
  success: boolean;
  data?: ChatResponse; 
  error?: string;
  workgroupLogs?: string[]; 
}

const LLM_API_TIMEOUT_MS_CHAT = 90000; 

export async function handleChatCompletion(
  messages: ChatMessage[],
  providerId: LLMProviderId, 
  apiKey: string,
  modelName: string,
  apiUrl?: string 
): Promise<ChatCompletionResponse> {
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
    if (!messages || messages.length === 0) {
      return { success: false, error: "Se requiere al menos un mensaje para iniciar el chat." };
    }

    const llmOptions: LLMOptions = {
      providerId: currentProvider.id,
      apiKey,
      modelName,
      apiUrl: apiUrl || currentProvider.apiUrl,
      timeoutMs: LLM_API_TIMEOUT_MS_CHAT,
    };
    
    const payload: ChatLLMPayload = {
      messages,
      options: llmOptions,
    };

    const result = await chatWithLLM(payload);
    return { success: true, data: result };
  } catch (error) {
    let detailMessage: string;
    if (error instanceof Error) {
        detailMessage = error.message;
    } else if (typeof error === 'string') {
        detailMessage = error;
    } else {
        detailMessage = "Ha ocurrido un error desconocido durante la operación.";
    }

    console.error(`Error en handleChatCompletion: ${detailMessage}`, {stack: (error as Error)?.stack}); 
    
    if (detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
      detailMessage = `La solicitud de chat excedió el tiempo límite de ${LLM_API_TIMEOUT_MS_CHAT / 1000} segundos. Intenta con un mensaje más corto o revisa la conexión.`;
    }
    
    return { success: false, error: `Falló la respuesta del chat: ${detailMessage}` };
  }
}


export async function initiateWorkgroupChat(
  messages: ChatMessage[], 
  workgroupId: string,
  allAgents: AgentConfig[],
  allWorkgroups: WorkgroupConfig[],
  localStorageSnapshot: LocalStorageSnapshot
): Promise<ChatCompletionResponse> {
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
            console.warn(`[CHAT_WG_LOG_SERIALIZATION_ERROR][${timestamp}] Failed to stringify data for log type ${type}, message: ${message}`, e);
        }
    }
    const logMsg = `[${timestamp}] [WG_Chat-${type}] ${message}${dataStringForLogMessage}`;
    console.log(`[${timestamp}] [WG_Chat-${type}] ${message}`, data);
    serverLogs.push(logMsg);
  };

  try {
    log('INFO', `Iniciando chat con grupo de trabajo ID: ${workgroupId}`);
    
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
          log('WARN', `Configuración LLM inválida para agente participante ${agent!.name}, será omitido si es seleccionado.`);
        }
        return acc;
      }, {} as WorkgroupTurnPayload['participantAgentConfigs']);

    const latestUserMessageContent = messages.findLast(m => m.role === 'user')?.content || "No se encontró el mensaje del usuario.";
    const formattedHistoryForPrompt = messages.map(m => `[${m.role === 'user' ? 'Usuario' : m.name || 'Asistente'}]: ${m.content}`).join('\n');

    const taskForWorkgroup = `El objetivo es responder al último mensaje del usuario en el contexto de la conversación.
  Tu rol como Orquestador es determinar el siguiente paso para lograr una respuesta coherente y útil.
  La respuesta final al usuario deberá ser textual y NO un objeto JSON.

  Historial de Conversación:
  ${formattedHistoryForPrompt}

  Último mensaje del Usuario: "${latestUserMessageContent}"

  Instrucción para ESTE TURNO (Orquestador): Basado en el último mensaje y el historial, decide qué agente debe formular la respuesta al usuario o si tú puedes consolidar una respuesta final. Tu decisión debe seguir el formato JSON especificado en tu prompt de sistema (next_agent_name, reason). Si decides que un agente debe responder, ese agente será el responsable de generar la respuesta textual directa al usuario.`;


    const MAX_CHAT_TURNS = 3; 
    let conversationHistoryForTurnProcessing = [...messages]; 

    for (let turn = 1; turn <= MAX_CHAT_TURNS; turn++) {
      log('INFO', `Procesando turno de chat ${turn}/${MAX_CHAT_TURNS}.`);
      const payload: WorkgroupTurnPayload = {
        workgroupName: workgroup.name, task: taskForWorkgroup,
        conversationHistory: conversationHistoryForTurnProcessing,
        orchestrator: {
          id: orchestrator.id, name: orchestrator.name, systemMessage: orchestrator.systemMessage,
          llmProviderId: orchestratorLlmOptions.providerId, llmModelName: orchestratorLlmOptions.modelName,
          llmApiKey: orchestratorLlmOptions.apiKey, llmApiUrl: orchestratorLlmOptions.apiUrl
        },
        participantAgentConfigs, currentTurn: turn, maxTurns: MAX_CHAT_TURNS, localStorageSnapshot,
      };

      const turnResult = await handleWorkgroupTurn(payload);
      serverLogs.push(...(turnResult.serverLogs || []).map(sl => `[Turn ${turn} ServerLog] ${sl}`));
      
      if (turnResult.error) {
        throw new Error(`Error en turno ${turn} del grupo de chat: ${turnResult.error}`);
      }

      conversationHistoryForTurnProcessing = turnResult.updatedHistory;

      if (turnResult.agentResponse?.content) {
        log('INFO', `Respuesta directa del agente ${turnResult.agentResponse.agentId} en turno ${turn}.`);
        return { success: true, data: { content: turnResult.agentResponse.content }, workgroupLogs: serverLogs };
      }

      if (turnResult.isComplete || turnResult.orchestratorDecision?.nextAgentId === "COMPLETADO") {
        log('INFO', `Grupo de trabajo de chat completado en el turno ${turn} por decisión del orquestador.`);
        const lastAssistantMessage = conversationHistoryForTurnProcessing.findLast(m => m.role === 'assistant');
        if (lastAssistantMessage?.content) {
          return { success: true, data: { content: lastAssistantMessage.content }, workgroupLogs: serverLogs };
        }
        const orchestratorReason = turnResult.orchestratorDecision?.reason;
        if (orchestratorReason && !turnResult.agentResponse?.content) {
            log('WARN', `Orquestador completó sin respuesta de agente explícita. Usando razón del orquestador como respuesta.`);
            return { success: true, data: { content: orchestratorReason}, workgroupLogs: serverLogs };
        }
        throw new Error("El grupo de trabajo de chat finalizó pero no se encontró una respuesta textual del asistente.");
      }
    }
    throw new Error(`El grupo de trabajo de chat no produjo una respuesta después de ${MAX_CHAT_TURNS} turnos.`);
  } catch (error) {
    let detailMessage: string;
    if (error instanceof Error) {
        detailMessage = error.message;
    } else if (typeof error === 'string') {
        detailMessage = error;
    } else {
        detailMessage = "Ha ocurrido un error desconocido durante la operación del grupo de chat.";
    }
    log('ERROR', `Error en initiateWorkgroupChat: ${detailMessage}`, {stack: (error as Error)?.stack});
    return { success: false, error: detailMessage, workgroupLogs: serverLogs };
  }
}