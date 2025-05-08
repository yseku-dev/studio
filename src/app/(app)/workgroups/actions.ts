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
  currentTurn: number;
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
                logMsg += ` | Data: ${JSON.stringify(data).substring(0, 300)}${JSON.stringify(data).length > 300 ? '...' : ''}`;
            } catch {
                logMsg += ` | Data: [Unserializable]`;
            }
        }
        console.log(logMsg); // Log on server console
        serverLogs.push(logMsg); // Collect for client
    };

    log('INFO', `Handling turn ${payload.currentTurn} for workgroup "${payload.workgroupName}"`);

    let updatedHistory = [...payload.conversationHistory];
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
        const orchestratorSystemPrompt = `${payload.orchestrator.systemMessage}\n\nCONTEXTO ACTUAL:\nTarea Principal: ${payload.task}\nAgentes Disponibles: ${availableAgentNames}\nHistorial de Conversación:\n${formatHistoryForPrompt(updatedHistory)}\n\nTU TURNO:\nBasado en la tarea y el historial, decide qué agente debe actuar a continuación O si la tarea está completada. Responde SÓLO con un objeto JSON válido que tenga las siguientes claves:\n- "next_agent_name": (string) El nombre EXACTO de uno de los agentes disponibles O la palabra "COMPLETADO" si la tarea ha finalizado.\n- "reason": (string) Una breve justificación de tu elección o del estado de completado.\n\nJSON:`;

        const orchestratorPayload: ChatLLMPayload = {
            messages: [{ role: 'system', content: orchestratorSystemPrompt }], // System prompt only for orchestrator
            options: orchestratorOptions,
        };
        log('DEBUG', 'Llamando a LLM del Orquestador...', { model: orchestratorOptions.modelName, promptStart: orchestratorSystemPrompt.substring(0, 200) });

        // Make the call - Expecting JSON response based on the prompt
        let orchestratorRawResponse = '';
        try {
            const decisionResult = await chatWithLLM(orchestratorPayload);
            orchestratorRawResponse = decisionResult.content;
             log('DEBUG', `Respuesta cruda del Orquestador recibida`, {raw: orchestratorRawResponse.substring(0,300) });

            // Attempt to parse the response as JSON
            const decisionJson = JSON.parse(orchestratorRawResponse.replace(/^```json\s*/, '').replace(/\s*```$/, ''));

            if (!decisionJson.next_agent_name || !decisionJson.reason) {
                throw new Error("Respuesta JSON del Orquestador inválida: faltan 'next_agent_name' o 'reason'.");
            }

             log('INFO', `Decisión del Orquestador: ${decisionJson.reason}. Próximo: ${decisionJson.next_agent_name}`);
             updatedHistory.push({ role: 'system', content: `[Orquestador decide: ${decisionJson.reason}. Próximo: ${decisionJson.next_agent_name}]`}); // Add decision to history

            if (decisionJson.next_agent_name.toUpperCase() === "COMPLETADO") {
                isComplete = true;
                 orchestratorDecision = {
                    nextAgentId: "COMPLETADO", // Use special value
                    reason: decisionJson.reason,
                    rawOutput: orchestratorRawResponse,
                 };
                log('INFO', `Orquestador determinó que la tarea está completa.`);
            } else {
                // Find the agent ID by name
                const nextAgent = Object.values(payload.participantAgentConfigs).find(a => a.name === decisionJson.next_agent_name);
                if (!nextAgent) {
                    throw new Error(`Orquestador eligió un agente inválido o no disponible: ${decisionJson.next_agent_name}`);
                }
                 orchestratorDecision = {
                    nextAgentId: nextAgent.id,
                    reason: decisionJson.reason,
                    rawOutput: orchestratorRawResponse,
                };

                // === 2. Selected Agent Responds ===
                if (!isComplete) {
                    log('INFO', `Agente seleccionado (${nextAgent.name}) preparando respuesta.`);
                    const agentOptions: LLMOptions = {
                        providerId: nextAgent.llmProviderId,
                        apiKey: nextAgent.llmApiKey || '',
                        modelName: nextAgent.llmModelName,
                        apiUrl: nextAgent.llmApiUrl,
                        timeoutMs: AGENT_RESPONSE_TIMEOUT_MS
                    };

                    const agentSystemPrompt = `${nextAgent.systemMessage}\n\nCONTEXTO:\nTarea Principal: ${payload.task}\nHistorial de Conversación Reciente:\n${formatHistoryForPrompt(updatedHistory)}\n\nTU TURNO:\nConsidera el historial y la tarea. Realiza tu contribución o responde.`;

                    const agentPayload: ChatLLMPayload = {
                        // Pass system message separately if needed by provider? Groq/OpenAI handle it in messages. Anthropic needs it separate.
                        // For simplicity, let's assume compatible providers handle it in messages.
                        messages: [
                            { role: 'system', content: agentSystemPrompt },
                             // Maybe filter history further? Or provide summary? For now, pass recent.
                            ...updatedHistory.slice(-6), // Pass last ~3 turns
                             { role: 'user', content: "Es tu turno de actuar basado en el contexto anterior."} // Generic prompt for agent
                        ],
                        options: agentOptions,
                    };
                    log('DEBUG', `Llamando a LLM del Agente (${nextAgent.name})...`, { model: agentOptions.modelName, promptStart: agentSystemPrompt.substring(0, 200) });

                    const agentLLMResponse = await chatWithLLM(agentPayload);
                    const agentResponseContent = agentLLMResponse.content;

                    log('INFO', `Respuesta recibida del Agente (${nextAgent.name})`, { length: agentResponseContent.length });
                    updatedHistory.push({ role: 'assistant', content: agentResponseContent }); // Add agent response to history

                    agentResponse = {
                        agentId: nextAgent.id,
                        content: agentResponseContent,
                        rawOutput: agentResponseContent, // Assuming text response for now
                    };
                }
            }

        } catch (err) {
            const error = err as Error;
             log('ERROR', `Error durante la llamada LLM del Orquestador: ${error.message}`, { stack: error.stack });
             // Add error to history?
             updatedHistory.push({ role: 'system', content: `[Error procesando decisión del Orquestador: ${error.message}]` });
             // Don't mark as complete, let client decide to retry or stop? Or just return error.
             return { error: `Error del Orquestador: ${error.message}`, isComplete: false, updatedHistory, serverLogs, orchestratorDecision: { nextAgentId: 'ERROR', reason: error.message, rawOutput: orchestratorRawResponse || undefined } };
        }


    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido en el servidor.';
        log('ERROR', `Error general en handleWorkgroupTurn: ${errorMsg}`, { stack: (error as Error).stack });
        return { error: errorMsg, isComplete: false, updatedHistory, serverLogs };
    }

    log('INFO', `Turno ${payload.currentTurn} completado.`);
    return { isComplete, updatedHistory, serverLogs, orchestratorDecision, agentResponse };
}


// Helper to format history for prompt context (simple version)
function formatHistoryForPrompt(history: ChatMessage[]): string {
    if (!history || history.length === 0) return "  (Sin historial previo)";
    // Get last ~6 messages (3 turns approx)
    return history.slice(-6).map(msg => `  [${msg.role === 'assistant' ? 'Agente' : msg.role === 'system' ? 'Sistema' : 'Usuario'}]: ${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}`)
        .join('\n');
}
