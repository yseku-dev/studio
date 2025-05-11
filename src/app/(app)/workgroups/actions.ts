
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
  localStorageSnapshot: LocalStorageSnapshot; // Added parameter
}

// Output response from the handleWorkgroupTurn action
export interface WorkgroupTurnResponse {
  // success: boolean; // Implicitly successful if no error is thrown or returned
  error?: string; // Error message if something failed
  isComplete: boolean; // Indicates if the orchestrator determined the task is complete
  updatedHistory: ChatMessage[]; // The conversation history including the messages from this turn
  serverLogs: string[]; // Logs generated during the server-side processing of the turn
  // Optional detailed outputs for logging/debugging on the client
  orchestratorDecision?: {
      nextAgentId: string;
      reason: string;
      rawOutput?: string; // Raw LLM output for debugging
  };
  agentResponse?: {
      agentId: string;
      content: string;
      rawOutput?: string; // Raw LLM output for debugging
  };
}

const ORCHESTRATOR_DECISION_TIMEOUT_MS = 45000; // 45 seconds for orchestrator decision
const AGENT_RESPONSE_TIMEOUT_MS = 90000; // 90 seconds for agent response

// --- Server Action ---

export async function handleWorkgroupTurn(payload: WorkgroupTurnPayload): Promise<WorkgroupTurnResponse> {
    const serverLogs: string[] = [];
    const log = (type: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        let logMsg = `[${timestamp}] [${type}] ${message}`;
        if (data) {
            try {
                const dataString = JSON.stringify(data, null, 2); // Pretty print JSON data
                logMsg += ` | Data: ${dataString}`; // No truncation
            } catch {
                logMsg += ` | Data: [Unserializable]`;
            }
        }
        console.log(logMsg); // Log on server console
        serverLogs.push(logMsg); // Collect for client
    };

    log('INFO', `Handling turn ${payload.currentTurn} for workgroup "${payload.workgroupName}"`);

    let currentHistory = [...payload.conversationHistory]; // Use a local copy for this turn's processing
    let isComplete = false;
    let orchestratorDecision: WorkgroupTurnResponse['orchestratorDecision'] | undefined;
    let agentResponse: WorkgroupTurnResponse['agentResponse'] | undefined;

    try {
        // === 1. Orchestrator Decides ===
        log('INFO', `Orchestrator (${payload.orchestrator.name}) deciding next step.`);

        const orchestratorOptions: LLMOptions = {
            providerId: payload.orchestrator.llmProviderId,
            apiKey: payload.orchestrator.llmApiKey || '',
            modelName: payload.orchestrator.llmModelName,
            apiUrl: payload.orchestrator.llmApiUrl,
            timeoutMs: ORCHESTRATOR_DECISION_TIMEOUT_MS
        };

        const availableAgentNames = Object.values(payload.participantAgentConfigs).map(a => a.name).join(', ');
        const orchestratorSystemPrompt = `${payload.orchestrator.systemMessage}

CONTEXTO ACTUAL:
Tarea Principal: ${payload.task}
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
            options: orchestratorOptions,
        };
        log('DEBUG', 'Llamando a LLM del Orquestrador...', { model: orchestratorOptions.modelName, promptStart: orchestratorSystemPrompt.substring(0,500) + "..." }); 

        let orchestratorRawResponse = '';
        let decisionJson: { next_agent_name: string; reason: string } | null = null;
        try {
            const decisionResult = await chatWithLLM(orchestratorPayload);
            orchestratorRawResponse = decisionResult.content;
            log('DEBUG', `Respuesta cruda del Orquestrador recibida`, {raw: orchestratorRawResponse.substring(0, 500) + "..."});

            let jsonString = orchestratorRawResponse;
            jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            jsonString = jsonString.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(); // Case-insensitive removal of think tags
            
            const firstBrace = jsonString.indexOf('{');
            const lastBrace = jsonString.lastIndexOf('}');

            if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
                log('ERROR', `Respuesta del Orquestrador no contiene un objeto JSON válido (sin llaves de apertura/cierre). Contenido: ${jsonString}`);
                throw new Error("Respuesta del Orquestrador no contiene un objeto JSON válido (sin llaves de apertura/cierre).");
            }

            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            
            decisionJson = JSON.parse(jsonString);

            if (!decisionJson || typeof decisionJson.next_agent_name !== 'string' || typeof decisionJson.reason !== 'string') {
                 log('ERROR', `Respuesta JSON del Orquestrador inválida. JSON parseado: ${JSON.stringify(decisionJson)}`, { originalJsonString: jsonString });
                throw new Error("Respuesta JSON del Orquestrador inválida: faltan 'next_agent_name' o 'reason', o tienen tipos incorrectos.");
            }

            log('INFO', `Decisión del Orquestrador: ${decisionJson.reason}. Próximo: ${decisionJson.next_agent_name}`);
            currentHistory.push({ role: 'system', content: `[Orquestador decide (Turno ${payload.currentTurn}): ${decisionJson.reason}. Próximo: ${decisionJson.next_agent_name}]`});

            if (decisionJson.next_agent_name.toUpperCase() === "COMPLETADO") {
                isComplete = true;
                 orchestratorDecision = {
                    nextAgentId: "COMPLETADO",
                    reason: decisionJson.reason,
                    rawOutput: orchestratorRawResponse,
                 };
                log('INFO', `Orquestador determinó que la tarea está completa en el turno ${payload.currentTurn}.`);
            } else {
                const nextAgentConfig = Object.values(payload.participantAgentConfigs).find(a => a.name === decisionJson?.next_agent_name);
                if (!nextAgentConfig) {
                    log('ERROR', `Orquestrador eligió un agente inválido o no disponible: ${decisionJson?.next_agent_name}. Agentes disponibles: ${availableAgentNames}`);
                    throw new Error(`Orquestrador eligió un agente inválido o no disponible: ${decisionJson?.next_agent_name}`);
                }
                 orchestratorDecision = {
                    nextAgentId: nextAgentConfig.id,
                    reason: decisionJson.reason,
                    rawOutput: orchestratorRawResponse,
                };

                log('INFO', `Agente seleccionado (${nextAgentConfig.name}) preparando respuesta.`);
                const agentOptions: LLMOptions = {
                    providerId: nextAgentConfig.llmProviderId,
                    apiKey: nextAgentConfig.llmApiKey || '',
                    modelName: nextAgentConfig.llmModelName,
                    apiUrl: nextAgentConfig.llmApiUrl,
                    timeoutMs: AGENT_RESPONSE_TIMEOUT_MS
                };

                 const agentHistoryContext = formatHistoryForPrompt(currentHistory, 10);
                 const agentSystemPrompt = `${nextAgentConfig.systemMessage}\n\nCONTEXTO:\nTarea Principal: ${payload.task}\nHistorial de Conversación Reciente:\n${agentHistoryContext}\n\nTU TURNO (Turno ${payload.currentTurn}):\nEl Orquestrador te ha pasado el control porque: "${orchestratorDecision.reason}".\nConsidera el historial y la tarea. Realiza tu contribución o responde. Sé conciso y directo.`;

                const agentPayload: ChatLLMPayload = {
                    messages: [{ role: 'system', content: agentSystemPrompt }],
                    options: agentOptions,
                };
                log('DEBUG', `Llamando a LLM del Agente (${nextAgentConfig.name})...`, { model: agentOptions.modelName, promptStart: agentSystemPrompt.substring(0,500) + "..." });

                const agentLLMResponse = await chatWithLLM(agentPayload);
                const agentResponseContent = agentLLMResponse.content;

                log('INFO', `Respuesta recibida del Agente (${nextAgentConfig.name})`, { length: agentResponseContent.length, contentStart: agentResponseContent.substring(0, 200) + (agentResponseContent.length > 200 ? '...' : '') });
                currentHistory.push({ role: 'assistant', content: agentResponseContent, name: nextAgentConfig.name }); // Add agent name to assistant message

                agentResponse = {
                    agentId: nextAgentConfig.id,
                    content: agentResponseContent,
                    rawOutput: agentResponseContent,
                };
            }
        } catch (err) {
            const error = err as Error;
            log('ERROR', `Error durante la llamada LLM del Orquestrador o al procesar su respuesta: ${error.message}`, { rawResponse: orchestratorRawResponse.substring(0,500) + "...", stack: error.stack });
            currentHistory.push({ role: 'system', content: `[Error procesando decisión del Orquestrador (Turno ${payload.currentTurn}): ${error.message}]` });
            return { error: `Error del Orquestrador: ${error.message}`, isComplete: false, updatedHistory: currentHistory, serverLogs, orchestratorDecision: { nextAgentId: 'ERROR', reason: error.message, rawOutput: orchestratorRawResponse || undefined } };
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido en el servidor.';
        log('ERROR', `Error general en handleWorkgroupTurn (Turno ${payload.currentTurn}): ${errorMsg}`, { stack: (error as Error).stack });
        return { error: errorMsg, isComplete: false, updatedHistory: currentHistory, serverLogs };
    }

    if (payload.currentTurn >= payload.maxTurns && !isComplete) {
        log('INFO', `Se alcanzó el límite máximo de turnos (${payload.maxTurns}). Finalizando ejecución.`);
        isComplete = true;
        currentHistory.push({ role: 'system', content: `[Sistema: Se alcanzó el límite de ${payload.maxTurns} turnos. Ejecución finalizada.]` });
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
        else if (msg.role === 'assistant') roleName = (msg as any).name || 'Agente'; // Try to get agent name if present
        else if (msg.role === 'system') roleName = 'Sistema';
        // Log full message content in prompt context
        return `  [${roleName}]: ${contentString.substring(0, 1000) + (contentString.length > 1000 ? "..." : "")}`; // Truncate long messages in prompt
    }).join('\n');
}

// Extend ChatMessage type to potentially include agent name for logging/prompt context
declare module '@/services/groq' {
    interface ChatMessage {
        name?: string; // Optional agent name
    }
}
