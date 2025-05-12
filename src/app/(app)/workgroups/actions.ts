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
      nextAgentId: string;
      reason: string;
      rawOutput?: string; 
  } | null; 
  agentResponse?: {
      agentId: string;
      content: string;
      rawOutput?: string; 
  } | null; 
}

const ORCHESTRATOR_DECISION_TIMEOUT_MS = 60000; // Increased from 45s to 60s
const AGENT_RESPONSE_TIMEOUT_MS = 120000; // Increased from 90s to 120s

// --- Server Action ---

export async function handleWorkgroupTurn(payload: WorkgroupTurnPayload): Promise<WorkgroupTurnResponse> {
    const serverLogs: string[] = [];
    const log = (type: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        let dataStringForLogMessage = '';
        if (data) {
            try {
                const previewData = (typeof data === 'object' && data !== null) 
                    ? JSON.stringify(data) 
                    : String(data);
                dataStringForLogMessage = ` | Data: ${previewData.substring(0, 1500)}${previewData.length > 1500 ? '...' : ''}`; 
            } catch {
                dataStringForLogMessage = ' | Data: [Unserializable para vista previa del log]';
            }
        }
        const logMsg = `[${timestamp}] [WG-${type}] ${message}${dataStringForLogMessage}`;
        console.log(`[${timestamp}] [WG-${type}] ${message}`, data); 
        serverLogs.push(logMsg); 
    };

    log('INFO', `Manejando turno ${payload.currentTurn} para grupo de trabajo "${payload.workgroupName}"`);

    let currentHistory = [...payload.conversationHistory]; 
    let isComplete = false;
    let orchestratorDecision: WorkgroupTurnResponse['orchestratorDecision'] = null;
    let agentResponse: WorkgroupTurnResponse['agentResponse'] = null;

    try {
        // === 1. Orchestrator Decides ===
        log('INFO', `Orquestador (${payload.orchestrator.name}) decidiendo próximo paso.`);

        const orchestratorOptions: LLMOptions = {
            providerId: payload.orchestrator.llmProviderId,
            apiKey: payload.orchestrator.llmApiKey || '',
            modelName: payload.orchestrator.llmModelName,
            apiUrl: payload.orchestrator.llmApiUrl,
            timeoutMs: ORCHESTRATOR_DECISION_TIMEOUT_MS
        };
        
        if (!orchestratorOptions.providerId || !orchestratorOptions.modelName) {
            log('ERROR', `Configuración LLM inválida para Orquestrador (${payload.orchestrator.name}): Falta providerId o modelName.`);
            return {
                error: `Configuración LLM inválida para Orquestrador (${payload.orchestrator.name})`,
                isComplete: false,
                updatedHistory: currentHistory,
                serverLogs,
                orchestratorDecision: null,
                agentResponse: null,
            };
        }


        const availableAgentNames = Object.values(payload.participantAgentConfigs).map(a => a.name).join(', ');
        
        // Truncate task view for orchestrator if it's too long (e.g., contains full source code)
        const MAX_TASK_VIEW_LENGTH_FOR_ORCHESTRATOR = 5000; // Characters
        const orchestratorTaskView = payload.task.length > MAX_TASK_VIEW_LENGTH_FOR_ORCHESTRATOR
            ? payload.task.substring(0, MAX_TASK_VIEW_LENGTH_FOR_ORCHESTRATOR) + "\n... (Contenido completo de la tarea es extenso y está disponible para los agentes especialistas)"
            : payload.task;

        const orchestratorSystemPrompt = `${payload.orchestrator.systemMessage} 
Tu rol es crítico: debes recibir y gestionar todas las respuestas generadas dentro del grupo. Basado en la tarea principal, el historial de conversación y el estado actual del proceso, decides a qué agente o subgrupo derivar la interacción. Todas las respuestas de los agentes deben pasar obligatoriamente por ti para asegurar un flujo coordinado y la toma de decisiones centralizada para completar la tarea del grupo eficientemente. No realizas la tarea directamente; facilitas que los otros agentes la completen. Pide aclaraciones si es necesario y resume el progreso. Si el usuario no propone un paso explícito, prioriza agentes con capacidades relevantes para la tarea actual.

CONTEXTO ACTUAL:
Tarea Principal (Vista para Orquestador): ${orchestratorTaskView} 
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
        log('DEBUG', `Llamando a LLM del Orquestrador...`, { model: orchestratorOptions.modelName, promptStart: orchestratorSystemPrompt.substring(0,500) + "..." }); 

        let orchestratorRawResponse = '';
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
                log('INFO', `Orquestador determinó que la tarea está completa en el turno ${payload.currentTurn}.`);
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
                const agentOptions: LLMOptions = {
                    providerId: nextAgentConfigFromPayload.llmProviderId,
                    apiKey: nextAgentConfigFromPayload.llmApiKey || '',
                    modelName: nextAgentConfigFromPayload.llmModelName,
                    apiUrl: nextAgentConfigFromPayload.llmApiUrl,
                    timeoutMs: AGENT_RESPONSE_TIMEOUT_MS
                };

                if (!agentOptions.providerId || !agentOptions.modelName) {
                     log('ERROR', `Configuración LLM inválida para agente ${nextAgentConfigFromPayload.name}: Falta providerId o modelName.`);
                     throw new Error(`Configuración LLM inválida para agente ${nextAgentConfigFromPayload.name}`);
                }

                 const agentHistoryContext = formatHistoryForPrompt(currentHistory, 10);
                 // When passing the task to the specialist, use the FULL payload.task
                 const agentSystemPrompt = `${nextAgentConfigFromPayload.systemMessage}\n\nCONTEXTO:\nTarea Principal del Grupo: ${payload.task}\nHistorial de Conversación Reciente:\n${agentHistoryContext}\n\nTU TURNO (Turno ${payload.currentTurn}):\nEl Orquestrador te ha pasado el control porque: "${orchestratorDecision.reason}".\nConsidera el historial y la tarea. Realiza tu contribución o responde. Sé conciso y directo.`;


                const agentPayload: ChatLLMPayload = {
                    messages: [{ role: 'system', content: agentSystemPrompt }],
                    options: agentOptions,
                };
                log('DEBUG', `Llamando a LLM del Agente (${nextAgentConfigFromPayload.name})...`, { model: agentOptions.modelName, promptStart: agentSystemPrompt.substring(0,500) + "..." });

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
            log('ERROR', `Fallo al parsear JSON del Orquestrador o error en su respuesta: ${error.message}`, { rawResponse: orchestratorRawResponse ? orchestratorRawResponse.substring(0,500) + (orchestratorRawResponse.length > 500 ? "..." : "") : "Respuesta cruda no disponible", stack: error.stack });
            currentHistory.push({ role: 'system', content: `[Error procesando decisión del Orquestrador (Turno ${payload.currentTurn}): ${error.message}]` , name: payload.orchestrator.name});
            return { error: `Error del Orquestador (fallo al procesar respuesta): ${error.message}`, isComplete: false, updatedHistory: currentHistory, serverLogs, orchestratorDecision: { nextAgentId: 'ERROR', reason: error.message, rawOutput: orchestratorRawResponse || 'Respuesta cruda no disponible' }, agentResponse: null };
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
        log('ERROR', `Error general en handleWorkgroupTurn (Turno ${payload.currentTurn}): ${detailMessage}`, { stack: (error as Error)?.stack });
        
        const safeServerLogs = serverLogs.map(logEntry => String(logEntry));
        const safeUpdatedHistory = currentHistory.map(msg => ({
            role: msg.role,
            content: String(msg.content), 
            name: msg.name ? String(msg.name) : undefined
        }));

        return {
            error: detailMessage,
            isComplete: false,
            updatedHistory: safeUpdatedHistory,
            serverLogs: safeServerLogs,
            orchestratorDecision: null, 
            agentResponse: null, 
        };
    }

    if (payload.currentTurn >= payload.maxTurns && !isComplete) {
        log('INFO', `Se alcanzó el límite máximo de turnos (${payload.maxTurns}). Finalizando ejecución.`);
        isComplete = true; 
        currentHistory.push({ role: 'system', content: `[Sistema: Se alcanzó el límite de ${payload.maxTurns} turnos. Ejecución finalizada.]` });
    } else if (isComplete && payload.currentTurn <= payload.maxTurns) { // Corrected condition
        log('INFO', `Orquestador marcó la tarea como completada en el turno ${payload.currentTurn}. Finalizando ejecución.`);
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
        else if (msg.role === 'assistant') roleName = (msg as any).name || 'Agente'; 
        else if (msg.role === 'system') {
             // Try to get agent name if it's a system message from an agent
            const agentName = (msg as any).name;
            roleName = agentName ? `Sistema (${agentName})` : 'Sistema';
        }
        return `  [${roleName}]: ${contentString.substring(0,1000)}${contentString.length > 1000 ? '...' : ''}`; 
    }).join('\n');
}
