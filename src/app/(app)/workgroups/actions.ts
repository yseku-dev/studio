// src/app/(app)/workgroups/actions.ts
'use server';

import type { AgentConfig, AgentLLMConfig } from '@/types/agent';
import { chatWithLLM, type LLMOptions, type ChatMessage, type ChatLLMPayload } from '@/services/groq';
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';

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
                // Increase substring limit significantly for debugging, or remove entirely if feasible
                const dataString = JSON.stringify(data);
                logMsg += ` | Data: ${dataString.substring(0, 1000)}${dataString.length > 1000 ? '...' : ''}`;
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
        // Updated prompt: More strict JSON instructions
        const orchestratorSystemPrompt = `${payload.orchestrator.systemMessage}

CONTEXTO ACTUAL:
Tarea Principal: ${payload.task}
Agentes Disponibles: ${availableAgentNames}
Historial de Conversación Reciente:
${formatHistoryForPrompt(currentHistory)}

TU TURNO (Turno ${payload.currentTurn} de ${payload.maxTurns}):
Basado en la tarea y el historial, decide qué agente debe actuar a continuación O si la tarea está completada.

IMPORTANTE: Tu respuesta DEBE SER EXCLUSIVAMENTE un objeto JSON válido, sin ningún texto, explicación, pensamiento o etiqueta (como <think>) antes o después. El JSON debe contener las siguientes claves EXACTAS:
- "next_agent_name": (string) El nombre EXACTO de uno de los agentes disponibles O la palabra "COMPLETADO" si la tarea ha finalizado.
- "reason": (string) Una breve justificación concisa de tu elección o del estado de completado.

No incluyas nada más en tu respuesta. Solo el objeto JSON.

JSON:`;


        const orchestratorPayload: ChatLLMPayload = {
            messages: [{ role: 'system', content: orchestratorSystemPrompt }], // System prompt only for orchestrator
            options: orchestratorOptions,
        };
        log('DEBUG', 'Llamando a LLM del Orquestrador...', { model: orchestratorOptions.modelName, promptStart: orchestratorSystemPrompt.substring(0, 500) }); // Log more of the prompt

        // Make the call - Expecting JSON response based on the prompt
        let orchestratorRawResponse = '';
        let decisionJson: { next_agent_name: string; reason: string } | null = null;
        try {
            const decisionResult = await chatWithLLM(orchestratorPayload);
            orchestratorRawResponse = decisionResult.content;
             log('DEBUG', `Respuesta cruda del Orquestrador recibida`, {raw: orchestratorRawResponse}); // Log full raw response for debugging

            // Attempt to parse the response as JSON - Added basic cleaning
            let cleanedResponse = orchestratorRawResponse.trim();
            // Attempt to remove common wrappers like ```json ... ``` or potential XML-like tags
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
             const jsonMatch = cleanedResponse.match(/\{.*\}/s); // Find first valid-looking JSON object

            if (!jsonMatch) {
                throw new Error("No se encontró un objeto JSON válido en la respuesta del Orquestrador.");
            }

            decisionJson = JSON.parse(jsonMatch[0]); // Parse only the matched JSON part

            if (!decisionJson || typeof decisionJson.next_agent_name !== 'string' || typeof decisionJson.reason !== 'string') {
                throw new Error("Respuesta JSON del Orquestrador inválida: faltan 'next_agent_name' o 'reason', o tienen tipos incorrectos.");
            }

             log('INFO', `Decisión del Orquestrador: ${decisionJson.reason}. Próximo: ${decisionJson.next_agent_name}`);
             // Update history immediately after successful decision
             currentHistory.push({ role: 'system', content: `[Orquestador decide (Turno ${payload.currentTurn}): ${decisionJson.reason}. Próximo: ${decisionJson.next_agent_name}]`});


            if (decisionJson.next_agent_name.toUpperCase() === "COMPLETADO") {
                isComplete = true;
                 orchestratorDecision = {
                    nextAgentId: "COMPLETADO", // Use special value
                    reason: decisionJson.reason,
                    rawOutput: orchestratorRawResponse,
                 };
                log('INFO', `Orquestador determinó que la tarea está completa en el turno ${payload.currentTurn}.`);
            } else {
                // Find the agent ID by name
                const nextAgent = Object.values(payload.participantAgentConfigs).find(a => a.name === decisionJson?.next_agent_name);
                if (!nextAgent) {
                    throw new Error(`Orquestrador eligió un agente inválido o no disponible: ${decisionJson?.next_agent_name}`);
                }
                 orchestratorDecision = {
                    nextAgentId: nextAgent.id,
                    reason: decisionJson.reason,
                    rawOutput: orchestratorRawResponse,
                };

                // === 2. Selected Agent Responds ===
                // No need to check isComplete again here, as it's handled by the else block
                log('INFO', `Agente seleccionado (${nextAgent.name}) preparando respuesta.`);
                const agentOptions: LLMOptions = {
                    providerId: nextAgent.llmProviderId,
                    apiKey: nextAgent.llmApiKey || '',
                    modelName: nextAgent.llmModelName,
                    apiUrl: nextAgent.llmApiUrl,
                    timeoutMs: AGENT_RESPONSE_TIMEOUT_MS
                };

                 // Format history more robustly for the agent prompt
                 const agentHistoryContext = formatHistoryForPrompt(currentHistory, 10); // Pass last 10 messages

                 const agentSystemPrompt = `${nextAgent.systemMessage}\n\nCONTEXTO:\nTarea Principal: ${payload.task}\nHistorial de Conversación Reciente:\n${agentHistoryContext}\n\nTU TURNO (Turno ${payload.currentTurn}):\nEl Orquestrador te ha pasado el control porque: "${orchestratorDecision.reason}".\nConsidera el historial y la tarea. Realiza tu contribución o responde. Sé conciso y directo.`;

                const agentPayload: ChatLLMPayload = {
                    messages: [
                        { role: 'system', content: agentSystemPrompt },
                         // Consider filtering history for the agent if it becomes too large
                         //{ role: 'user', content: `Basado en el contexto y la razón del orquestrador ("${orchestratorDecision.reason}"), es tu turno de actuar.`} // More specific prompt
                    ],
                    options: agentOptions,
                };
                log('DEBUG', `Llamando a LLM del Agente (${nextAgent.name})...`, { model: agentOptions.modelName, promptStart: agentSystemPrompt.substring(0, 500) }); // Log more prompt

                const agentLLMResponse = await chatWithLLM(agentPayload);
                const agentResponseContent = agentLLMResponse.content;

                log('INFO', `Respuesta recibida del Agente (${nextAgent.name})`, { length: agentResponseContent.length });
                // Add agent response to history *after* logging
                currentHistory.push({ role: 'assistant', content: agentResponseContent });

                agentResponse = {
                    agentId: nextAgent.id,
                    content: agentResponseContent,
                    rawOutput: agentResponseContent, // Log full response
                };

            }

        } catch (err) {
            const error = err as Error;
             log('ERROR', `Error durante la llamada LLM del Orquestrador o al procesar su respuesta: ${error.message}`, { rawResponse: orchestratorRawResponse, stack: error.stack });
             // Add error to history
             currentHistory.push({ role: 'system', content: `[Error procesando decisión del Orquestrador (Turno ${payload.currentTurn}): ${error.message}]` });

             // Return error, don't mark as complete, let client handle
             return { error: `Error del Orquestrador: ${error.message}`, isComplete: false, updatedHistory: currentHistory, serverLogs, orchestratorDecision: { nextAgentId: 'ERROR', reason: error.message, rawOutput: orchestratorRawResponse || undefined } };
        }


    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido en el servidor.';
        log('ERROR', `Error general en handleWorkgroupTurn (Turno ${payload.currentTurn}): ${errorMsg}`, { stack: (error as Error).stack });
        return { error: errorMsg, isComplete: false, updatedHistory: currentHistory, serverLogs };
    }

    // Check completion status *after* the turn logic
    if (payload.currentTurn >= payload.maxTurns && !isComplete) {
        log('INFO', `Se alcanzó el límite máximo de turnos (${payload.maxTurns}). Finalizando ejecución.`);
        isComplete = true; // Mark as complete due to max turns
        currentHistory.push({ role: 'system', content: `[Sistema: Se alcanzó el límite de ${payload.maxTurns} turnos. Ejecución finalizada.]` });
    }


    log('INFO', `Turno ${payload.currentTurn} completado.`);
    // Return the potentially updated history
    return { isComplete, updatedHistory: currentHistory, serverLogs, orchestratorDecision, agentResponse };
}


// Helper to format history for prompt context (simple version)
function formatHistoryForPrompt(history: ChatMessage[], maxMessages: number = 6): string {
    if (!history || history.length === 0) return "  (Sin historial previo)";
    // Get last N messages
    return history.slice(-maxMessages).map(msg => {
        // Ensure content is a string before substring
        const contentString = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
         // Determine role display name
         let roleName = 'Desconocido';
         if (msg.role === 'user') roleName = 'Usuario';
         else if (msg.role === 'assistant') roleName = 'Agente'; // Could potentially add agent name here if available in ChatMessage
         else if (msg.role === 'system') roleName = 'Sistema';

         // Increased substring limit for more context
        return `  [${roleName}]: ${contentString.substring(0, 500)}${contentString.length > 500 ? '...' : ''}`
    }).join('\n');
}

    