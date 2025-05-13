// src/app/(app)/workgroups/actions.ts
'use server';

import type { AgentConfig, AgentLLMConfig } from '@/types/agent';
import { chatWithLLM, type LLMOptions, type ChatMessage, type ChatLLMPayload } from '@/services/groq';
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils'; 

// --- Types for Server Action ---

// Represents the configuration for an agent passed to the server action
interface AgentTurnConfig {
    id: string;
    name: string;
    systemMessage: string;
    llmProviderId: LLMProviderId;
    llmModelName: string;
    llmApiKey: string | null;
    llmApiUrl?: string;
}

// Input payload for the handleWorkgroupTurn action
export interface WorkgroupTurnPayload {
  workgroupName: string;
  task: string;
  conversationHistory: ChatMessage[]; // History of user/assistant messages from previous turns
  orchestrator: AgentTurnConfig;
  participantAgentConfigs: Record<string, AgentTurnConfig>; // Configs for agents the orchestrator can choose from
  currentTurn: number; // The turn number *being processed*
  maxTurns: number;
  localStorageSnapshot: LocalStorageSnapshot; 
}

// Output response from the handleWorkgroupTurn action
export interface WorkgroupTurnResponse {
  error?: string; 
  isComplete: boolean; 
  updatedHistory: ChatMessage[]; 
  serverLogs: string[]; 
  orchestratorDecision?: {
      nextAgentId: string; // Can be agent ID or "COMPLETADO" or "ERROR_ORCHESTRATOR"
      reason: string;
      rawOutput?: string; 
  } | null; 
  agentResponse?: {
      agentId: string;
      content: string;
      rawOutput?: string; 
  } | null; 
}

const ORCHESTRATOR_DECISION_TIMEOUT_MS = 60000; 
const AGENT_RESPONSE_TIMEOUT_MS = 120000; 

// --- Server Action ---

export async function handleWorkgroupTurn(payload: WorkgroupTurnPayload): Promise<WorkgroupTurnResponse> {
    const serverLogs: string[] = [];
    const log = (type: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        let dataStringForLogMessage = '';
        if (data !== undefined) {
            try {
                let dataPreviewString = '';
                if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean' || data === null) {
                    dataPreviewString = String(data);
                } else if (data instanceof Error) { 
                    dataPreviewString = `Error: ${data.message}${data.stack ? `\nStack: ${data.stack}` : ''}`;
                }
                else {
                    dataPreviewString = JSON.stringify(data); 
                }
                dataStringForLogMessage = ` | Data: ${dataPreviewString.substring(0, 300)}${dataPreviewString.length > 300 ? '...' : ''}`;
            } catch (e) {
                dataStringForLogMessage = ' | Data: [Contenido no serializable para vista previa del log]';
                console.warn(`[WORKGROUP_LOG_SERIALIZATION_ERROR][${timestamp}] Failed to stringify data for log type ${type}, message: ${message}`, e);
            }
        }
        const logMsg = `[${timestamp}] [WG-${type}] ${message}${dataStringForLogMessage}`;
        console.log(`[${timestamp}] [WG-${type}] ${message}`, data); 
        serverLogs.push(logMsg); 
    };

    log('INFO', `Handling turn ${payload.currentTurn} for workgroup "${payload.workgroupName}"`);

    let currentHistory = [...payload.conversationHistory]; 
    let isComplete = false;
    let orchestratorDecision: WorkgroupTurnResponse['orchestratorDecision'] = null;
    let agentResponse: WorkgroupTurnResponse['agentResponse'] = null;
    let orchestratorRawResponse = ''; 

    try {
        // === 1. Orchestrator Decides ===
        log('INFO', `Orchestrator (${payload.orchestrator.name}) deciding next step.`);
        
        // Directly use LLM options from payload for the orchestrator
        const orchestratorLlmOptionsDirect: LLMOptions = {
            providerId: payload.orchestrator.llmProviderId,
            modelName: payload.orchestrator.llmModelName,
            apiKey: payload.orchestrator.llmApiKey || '',
            apiUrl: payload.orchestrator.llmApiUrl || undefined,
            timeoutMs: ORCHESTRATOR_DECISION_TIMEOUT_MS,
        };

        const availableAgentNames = Object.values(payload.participantAgentConfigs).map(a => a.name).join(', ');
        
        const MAX_TASK_VIEW_LENGTH_FOR_ORCHESTRATOR = 5000; 
        const orchestratorTaskView = payload.task.length > MAX_TASK_VIEW_LENGTH_FOR_ORCHESTRATOR
            ? payload.task.substring(0, MAX_TASK_VIEW_LENGTH_FOR_ORCHESTRATOR) + "\n... (Contenido completo de la tarea es extenso y está disponible para los agentes especialistas)"
            : payload.task;

        const orchestratorSystemPrompt = `${payload.orchestrator.systemMessage} 
CONTEXTO ACTUAL:
Tarea Principal (Vista para Orquestrador): ${orchestratorTaskView} 
Agentes Disponibles: ${availableAgentNames}
Historial de Conversación Reciente:
${formatHistoryForPrompt(currentHistory)}

TU TURNO (Turno ${payload.currentTurn} de ${payload.maxTurns}):
Basado en la tarea y el historial, decide qué agente debe actuar a continuación O si la tarea está completada.

IMPORTANTE: Tu respuesta DEBE SER EXCLUSIVAMENTE un objeto JSON válido, sin ningún texto, explicación, pensamiento o etiqueta (como <think> o similar) antes o después. El JSON debe contener las siguientes claves EXACTAS:
- "next_agent_name": (string) El nombre EXACTO de uno de los agentes disponibles O la palabra "COMPLETADO" si la tarea ha finalizado.
- "reason": (string) Una breve justificación concisa de tu elección o del estado de completado.

No incluyas nada más en tu respuesta. Solo el objeto JSON.

JSON:`;

        const orchestratorPayload: ChatLLMPayload = {
            messages: [{ role: 'system', content: orchestratorSystemPrompt }],
            options: orchestratorLlmOptionsDirect,
        };
        log('DEBUG', `Llamando a LLM del Orquestrador...`, { model: orchestratorLlmOptionsDirect.modelName, promptStart: orchestratorSystemPrompt.substring(0,500) + "..." }); 
        
        let decisionJson: { next_agent_name: string; reason: string } | null = null;
        try {
            const decisionResult = await chatWithLLM(orchestratorPayload);
            orchestratorRawResponse = decisionResult.content;
            log('DEBUG', `Respuesta cruda del Orquestrador recibida`, {raw: orchestratorRawResponse.substring(0, 500) + (orchestratorRawResponse.length > 500 ? "..." : "")}); 

            let jsonString = orchestratorRawResponse;
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (jsonMatch && jsonMatch[0]) {
                jsonString = jsonMatch[0];
            } else {
                log('ERROR', `Respuesta del Orquestrador no contenía un bloque JSON reconocible. Contenido: ${jsonString.substring(0,500)}...`);
                throw new Error("Respuesta del Orquestrador no contenía un bloque JSON reconocible.");
            }
            
            decisionJson = JSON.parse(jsonString);

            if (!decisionJson || typeof decisionJson.next_agent_name !== 'string' || typeof decisionJson.reason !== 'string') {
                log('ERROR', `Respuesta JSON del Orquestrador inválida. JSON parseado: ${JSON.stringify(decisionJson)}`, { originalJsonString: jsonString.substring(0,500) });
                throw new Error("Respuesta JSON del Orquestrador inválida: faltan 'next_agent_name' o 'reason', o tienen tipos incorrectos.");
            }

            log('INFO', `Decisión del Orquestrador: ${decisionJson.reason}. Próximo: ${decisionJson.next_agent_name}`);
            currentHistory.push({ role: 'system', content: `[Orquestador decide (Turno ${payload.currentTurn}): ${decisionJson.reason}. Próximo: ${decisionJson.next_agent_name}]`, name: payload.orchestrator.name });

            if (decisionJson.next_agent_name.toUpperCase() === "COMPLETADO") {
                isComplete = true;
                 orchestratorDecision = {
                    nextAgentId: "COMPLETADO",
                    reason: decisionJson.reason,
                    rawOutput: orchestratorRawResponse,
                 };
                log('INFO', `Orquestrador determinó que la tarea está completa en el turno ${payload.currentTurn}.`);
            } else {
                const nextAgentConfigFromPayload = Object.values(payload.participantAgentConfigs).find(a => a.name === decisionJson?.next_agent_name);

                if (!nextAgentConfigFromPayload) {
                    log('ERROR', `Orquestrador eligió un agente inválido o no disponible: ${decisionJson?.next_agent_name}. Agentes disponibles: ${availableAgentNames}`);
                    throw new Error(`Orquestrador eligió un agente inválido o no disponible: ${decisionJson?.next_agent_name}`);
                }
                 orchestratorDecision = {
                    nextAgentId: nextAgentConfigFromPayload.id,
                    reason: decisionJson.reason,
                    rawOutput: orchestratorRawResponse,
                };

                log('INFO', `Agente seleccionado (${nextAgentConfigFromPayload.name}) preparando respuesta.`);
                
                // Directly use LLM options from the pre-resolved nextAgentConfigFromPayload
                const agentLlmOptionsDirect: LLMOptions = {
                    providerId: nextAgentConfigFromPayload.llmProviderId,
                    modelName: nextAgentConfigFromPayload.llmModelName,
                    apiKey: nextAgentConfigFromPayload.llmApiKey || '',
                    apiUrl: nextAgentConfigFromPayload.llmApiUrl || undefined,
                    timeoutMs: AGENT_RESPONSE_TIMEOUT_MS,
                };

                 const agentHistoryContext = formatHistoryForPrompt(currentHistory, 10);
                 const agentSystemPrompt = `${nextAgentConfigFromPayload.systemMessage}\n\nCONTEXTO:\nTarea Principal del Grupo: ${payload.task}\nHistorial de Conversación Reciente:\n${agentHistoryContext}\n\nTU TURNO (Turno ${payload.currentTurn}):\nEl Orquestrador te ha pasado el control porque: "${orchestratorDecision.reason}".\nConsidera el historial y la tarea. Realiza tu contribución o responde. Sé conciso y directo.`;

                const agentPayload: ChatLLMPayload = {
                    messages: [{ role: 'system', content: agentSystemPrompt }],
                    options: agentLlmOptionsDirect,
                };
                log('DEBUG', `Llamando a LLM del Agente (${nextAgentConfigFromPayload.name})...`, { model: agentLlmOptionsDirect.modelName, promptStart: agentSystemPrompt.substring(0,500) + "..." });

                const agentLLMResponse = await chatWithLLM(agentPayload);
                const agentResponseContent = agentLLMResponse.content;

                log('INFO', `Respuesta recibida del Agente (${nextAgentConfigFromPayload.name})`, { length: agentResponseContent.length, contentStart: agentResponseContent.substring(0,100) + (agentResponseContent.length > 100 ? "..." : "") }); 
                currentHistory.push({ role: 'assistant', content: agentResponseContent, name: nextAgentConfigFromPayload.name }); 

                agentResponse = {
                    agentId: nextAgentConfigFromPayload.id,
                    content: agentResponseContent,
                    rawOutput: agentResponseContent, 
                };
            }
        } catch (err) { 
            const error = err as Error;
            log('ERROR', `Fallo al procesar JSON del Orquestrador o error en su respuesta LLM: ${error.message}`, { rawResponse: orchestratorRawResponse ? orchestratorRawResponse.substring(0,500) + (orchestratorRawResponse.length > 500 ? "..." : "") : "Respuesta cruda no disponible", stack: error.stack });
            currentHistory.push({ role: 'system', content: `[Error procesando decisión del Orquestrador (Turno ${payload.currentTurn}): ${error.message}]` , name: payload.orchestrator.name});
            return { 
                error: `Error del Orquestrador (fallo al procesar respuesta): ${String(error.message || "Error desconocido.")}`, 
                isComplete: true, 
                updatedHistory: currentHistory.map(m => ({...m, content: String(m.content || '')})), 
                serverLogs: serverLogs.map(s => String(s || '')), 
                orchestratorDecision: { 
                    nextAgentId: 'ERROR_ORCHESTRATOR', 
                    reason: String(error.message || "Error desconocido."), 
                    rawOutput: orchestratorRawResponse || 'Respuesta cruda no disponible' 
                }, 
                agentResponse: null 
            };
        }
    } catch (error) { 
        let detailMessage: string;
        if (error instanceof Error) {
            detailMessage = error.message;
        } else {
            detailMessage = typeof error === 'string' ? error : "Ha ocurrido un error desconocido durante la operación del grupo de trabajo.";
        }
        if (!detailMessage || detailMessage.trim() === "") {
            detailMessage = "Error desconocido o el servidor no proporcionó detalles.";
        }
        
        console.error(`[WORKGROUP_ACTION_ERROR] Turn ${payload.currentTurn} failed: ${detailMessage}`, { stack: (error as Error)?.stack, fullError: error });
        serverLogs.push(`[${new Date().toISOString()}] [FATAL_ERROR_WORKGROUP_TURN] ${detailMessage}`);

        let safeHistoryForError: ChatMessage[];
        try {
            safeHistoryForError = currentHistory.map(msg => ({
                role: msg.role,
                content: String(msg.content || '').substring(0, 1000), 
                name: msg.name ? String(msg.name).substring(0, 100) : undefined
            }));
        } catch {
            safeHistoryForError = [{role: 'system', content: 'Error processing history for error response.'}];
        }

        let safeLogsForError: string[];
        try {
            safeLogsForError = serverLogs.map(logEntry => String(logEntry || '').substring(0, 500));
        } catch {
            safeLogsForError = ['Error processing server logs for error response.'];
        }

        return {
            error: `SERVER_ACTION_UNHANDLED_ERROR: ${String(detailMessage || 'Unknown error').substring(0, 500)}`, 
            isComplete: true, 
            updatedHistory: safeHistoryForError,
            serverLogs: safeLogsForError,
            orchestratorDecision: null,
            agentResponse: null,
        };
    }

    if (payload.currentTurn >= payload.maxTurns && !isComplete) {
        log('INFO', `Se alcanzó el límite máximo de turnos (${payload.maxTurns}). Finalizando ejecución.`);
        isComplete = true; 
        currentHistory.push({ role: 'system', content: `[Sistema: Se alcanzó el límite de ${payload.maxTurns} turnos. Ejecución finalizada.]` });
    } else if (isComplete && payload.currentTurn <= payload.maxTurns) { 
        log('INFO', `Orquestrador marcó la tarea como completada en el turno ${payload.currentTurn}. Finalizando ejecución.`);
    }

    log('INFO', `Turno ${payload.currentTurn} completado.`);
    return { isComplete, updatedHistory: currentHistory, serverLogs, orchestratorDecision, agentResponse };
}

function formatHistoryForPrompt(history: ChatMessage[], maxMessages: number = 6): string {
    if (!history || history.length === 0) return "  (Sin historial previo)";
    return history.slice(-maxMessages).map(msg => {
        const contentString = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        let roleName = 'Desconocido';
        if (msg.role === 'user') roleName = 'Usuario';
        else if (msg.role === 'assistant') roleName = msg.name || 'Agente'; 
        else if (msg.role === 'system') {
            const agentName = msg.name;
            roleName = agentName ? `Sistema (${agentName})` : 'Sistema';
        }
        return `  [${roleName}]: ${contentString.substring(0,1000)}${contentString.length > 1000 ? '...' : ''}`; 
    }).join('\n');
}

