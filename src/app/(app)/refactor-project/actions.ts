// src/app/(app)/refactor-project/actions.ts
'use server';

import type { LLMOptions, ChatMessage } from '@/services/groq';
// Assuming a generic service function similar to others for project-wide analysis
import { analyzeProjectSourceChunk } from '@/services/groq'; 
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS, REFACTOR_AGENT_NAME } from '@/config/agent-config';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import fs from 'fs/promises'; // For potential future file modifications
import path from 'path'; // For potential future file modifications

// TODO: Define these types more precisely based on expected AI output for refactoring
interface RefactoringSuggestionItem {
  area: string;
  description: string;
  priority: 'Alta' | 'Media' | 'Baja';
  suggestedSnippet?: string;
}

interface RefactorProjectAIResponse {
  refactoringSuggestions: RefactoringSuggestionItem[];
  summary?: string;
}

export interface HandleGetRefactoringSuggestionsPayload {
  projectFileContent?: string; // Changed from File object
  projectFileName?: string;    // Added for context
  projectFileType?: string;    // Added for context
  gitUrl?: string;
  goals?: string;
  priority?: "seguridad" | "legibilidad" | "rendimiento" | "estandarizar" | "reducir_complejidad";
  configSource: string; // e.g., "global", "agent:id", "workgroup:id"
  // LLMOptions are passed if configSource is 'global' or a specific agent (not a workgroup)
  // For workgroups, the server action resolves LLM options for orchestrator & participants internally
  llmOptions?: LLMOptions; 
  // Agents and workgroups lists are needed if configSource is a workgroup, to resolve its members
  agents?: AgentConfig[];
  workgroups?: WorkgroupConfig[];
  // localStorageSnapshot is needed if configSource is a workgroup, for its agents' LLM config resolution
  localStorageSnapshot?: LocalStorageSnapshot;
}

export interface HandleGetRefactoringSuggestionsResult {
  success: boolean;
  data?: RefactoringSuggestionItem[];
  error?: string;
  workgroupLogs?: string[];
}

const REFACTOR_LLM_API_TIMEOUT_MS = 180000;


// --- Main Action to get Refactoring Suggestions ---
export async function handleGetRefactoringSuggestions(
  payload: HandleGetRefactoringSuggestionsPayload
): Promise<HandleGetRefactoringSuggestionsResult> {
  const serverLogs: string[] = [];
  const log = (type: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
    const logMsg = `[RefactorProj-${type}] ${message}${data ? ' | Data: ' + JSON.stringify(data).substring(0, 300) : ''}`;
    console.log(logMsg);
    serverLogs.push(logMsg);
  };

  log('INFO', `Iniciando obtención de sugerencias de refactorización.`);

  let projectContent: string | undefined = undefined;

  if (payload.projectFileContent) {
    log('INFO', `Procesando contenido de archivo: ${payload.projectFileName} (${payload.projectFileType})`);
    if (payload.projectFileType === 'application/json' || payload.projectFileName?.endsWith('.json') || payload.projectFileType?.startsWith('text/')) {
        projectContent = payload.projectFileContent;
        log('INFO', `Contenido de archivo de texto/JSON procesado. Tamaño: ${projectContent.length}`);
    } else if (payload.projectFileType === 'application/zip' || payload.projectFileName?.endsWith('.zip')) {
         log('WARN', 'Procesamiento de ZIP (desde contenido string) aún no implementado. Usando placeholder con nombre de archivo.');
         projectContent = `// Contenido del proyecto ZIP (simulado a partir de string) para ${payload.projectFileName} - Implementar descompresión y concatenación si el contenido es el binario.`;
    } else {
        log('ERROR', `Tipo de archivo no soportado o contenido no textual: ${payload.projectFileName} (${payload.projectFileType})`);
        return { success: false, error: `Tipo de archivo no soportado o no es procesable como texto: ${payload.projectFileName}`, workgroupLogs: serverLogs };
    }
  } else if (payload.gitUrl) {
    log('INFO', `Procesando URL de Git: ${payload.gitUrl} (Simulado)`);
    projectContent = `// Contenido del proyecto desde Git URL ${payload.gitUrl} (simulado). Implementar clonación y extracción de contenido.`;
  }
  
  if (projectContent === undefined) {
    log('ERROR', 'No se proporcionó contenido de archivo ni URL de Git válidos.');
    return { success: false, error: "Fuente del proyecto no especificada o no procesable.", workgroupLogs: serverLogs };
  }


  // --- Determine LLM configuration ---
  let llmOptionsToUse: LLMOptions | null = null;
  let workgroupForAnalysis: WorkgroupConfig | undefined;
  let orchestratorAgentConfig: AgentConfig | undefined;

  if (payload.configSource.startsWith('workgroup:')) {
    const workgroupId = payload.configSource.split(':')[1];
    workgroupForAnalysis = payload.workgroups?.find(wg => wg.id === workgroupId);
    if (!workgroupForAnalysis) {
      log('ERROR', `Grupo de trabajo con ID ${workgroupId} no encontrado.`);
      return { success: false, error: `Grupo de trabajo '${workgroupId}' no encontrado.`, workgroupLogs: serverLogs };
    }
    // Ensure the orchestrator is part of this workgroup
    const orchestratorIdInGroup = workgroupForAnalysis.agentIds.find(agentId => {
        const agent = payload.agents?.find(a => a.id === agentId);
        return agent?.name === ORCHESTRATOR_AGENT_NAME;
    });
    orchestratorAgentConfig = payload.agents?.find(a => a.id === orchestratorIdInGroup);
    
    if (!orchestratorAgentConfig) {
      log('ERROR', `Agente Orquestador no encontrado en el grupo '${workgroupForAnalysis.name}'.`);
      return { success: false, error: `Agente Orquestador no encontrado en el grupo '${workgroupForAnalysis.name}'.`, workgroupLogs: serverLogs };
    }
     // For workgroups, LLM options are resolved internally during the turn.
     // We don't set llmOptionsToUse here for workgroups.
  } else {
    // Direct call (global or specific agent)
    if (payload.llmOptions) {
        llmOptionsToUse = payload.llmOptions;
        log('INFO', `Usando opciones LLM pasadas directamente: ${llmOptionsToUse.providerId} - ${llmOptionsToUse.modelName}`);
    } else {
        // This case should ideally not happen if client resolves correctly before calling
        log('ERROR', `Opciones LLM no proporcionadas para llamada directa (configSource: ${payload.configSource}). Reintentando resolución en servidor (puede fallar si localStorage no está disponible).`);
        if (payload.localStorageSnapshot) {
            llmOptionsToUse = resolveLlmOptionsForSource(payload.configSource, payload.agents || [], payload.workgroups || [], payload.localStorageSnapshot);
        }
    }
  }

  // This validation ensures that for direct calls, we have options, and for workgroups, we have a valid workgroup setup.
  if (!llmOptionsToUse && !workgroupForAnalysis) {
    log('ERROR', `Configuración LLM para '${payload.configSource}' no pudo ser resuelta o proporcionada, y no es un grupo de trabajo válido.`);
    return { success: false, error: `Configuración LLM para '${payload.configSource}' no pudo ser resuelta o proporcionada.`, workgroupLogs: serverLogs };
  }

  // --- Construct Prompt / Task ---
  const refactoringGoals = payload.goals ? `Metas de refactorización: "${payload.goals}".` : "Metas de refactorización generales: mejorar claridad, eficiencia y mantenibilidad.";
  const refactoringPriority = payload.priority ? `Prioridad general: "${payload.priority}".` : "";

  const systemPromptForDirectCallOrRefactorAgent = `Eres un agente experto en refactorización de código. Analiza el siguiente proyecto (archivos concatenados o JSON) y genera una lista de sugerencias de refactorización.
${refactoringGoals} ${refactoringPriority}
Tu respuesta DEBE ser un objeto JSON con la clave "refactoringSuggestions", que es un array de objetos. Cada objeto de sugerencia debe tener:
- "area": (string) El archivo/ruta relevante (ej: "src/components/MyComponent.tsx").
- "description": (string) Una descripción clara de la mejora propuesta.
- "priority": (string) "Alta", "Media", o "Baja".
- "suggestedSnippet": (string, opcional) Un fragmento de código que ilustra el cambio.
No incluyas markdown ni texto introductorio/conclusivo fuera del JSON.`;

  // Task for the workgroup's Orchestrator
  const taskForWorkgroup = `Analizar el siguiente proyecto para refactorización. ${refactoringGoals} ${refactoringPriority}
El proyecto es (contenido textual):
${projectContent.substring(0, 15000)} ${projectContent.length > 15000 ? "\n... (contenido truncado para el prompt)" : ""}
La respuesta final de un agente especialista en refactorización (probablemente ${REFACTOR_AGENT_NAME}) DEBE ser un objeto JSON con la clave "refactoringSuggestions" como se describe en el prompt del sistema del ${REFACTOR_AGENT_NAME}.
El Orquestador debe guiar el flujo para que ${REFACTOR_AGENT_NAME} reciba la tarea y el código para analizar.`;


  // --- Call LLM (Directly or via Workgroup) ---
  try {
    if (workgroupForAnalysis && orchestratorAgentConfig && payload.agents && payload.localStorageSnapshot) {
      log('INFO', `Usando grupo de trabajo "${workgroupForAnalysis.name}" para refactorización.`);
      
      const orchestratorLlmOptions = resolveLlmOptionsForSource(`agent:${orchestratorAgentConfig.id}`, payload.agents, payload.workgroups || [], payload.localStorageSnapshot);
      if (!orchestratorLlmOptions) {
        log('ERROR', `Configuración LLM inválida para Orquestador (${orchestratorAgentConfig.name}) en grupo ${workgroupForAnalysis.name}.`);
        throw new Error(`Configuración LLM inválida para Orquestador en grupo '${workgroupForAnalysis.name}'.`);
      }

      const participantAgentConfigs = workgroupForAnalysis.agentIds
        .filter(id => id !== orchestratorAgentConfig!.id)
        .map(id => payload.agents!.find(a => a.id === id))
        .filter(agent => agent !== undefined)
        .reduce((acc, agent) => {
          const options = resolveLlmOptionsForSource(`agent:${agent!.id}`, payload.agents!, payload.workgroups || [], payload.localStorageSnapshot!);
          if (options) {
            acc[agent!.id] = {
              id: agent!.id, name: agent!.name, systemMessage: agent!.systemMessage,
              llmProviderId: options.providerId, llmModelName: options.modelName,
              llmApiKey: options.apiKey, llmApiUrl: options.apiUrl
            };
          } else {
            log('WARN', `Configuración LLM inválida para agente participante ${agent!.name}, será omitido de este turno si es seleccionado por el orquestador sin config válida.`);
          }
          return acc;
        }, {} as WorkgroupTurnPayload['participantAgentConfigs']);

      let conversationHistory: ChatMessage[] = [];
      for (let turn = 1; turn <= MAX_WORKGROUP_TURNS; turn++) {
        log('INFO', `Procesando turno de grupo ${turn}/${MAX_WORKGROUP_TURNS} para refactorización.`);
        const turnPayload: WorkgroupTurnPayload = {
            workgroupName: workgroupForAnalysis.name, task: taskForWorkgroup, conversationHistory,
            orchestrator: {
                id: orchestratorAgentConfig.id, name: orchestratorAgentConfig.name, systemMessage: orchestratorAgentConfig.systemMessage,
                llmProviderId: orchestratorLlmOptions.providerId, llmModelName: orchestratorLlmOptions.modelName,
                llmApiKey: orchestratorLlmOptions.apiKey, llmApiUrl: orchestratorLlmOptions.apiUrl,
            },
            participantAgentConfigs, currentTurn: turn, maxTurns: MAX_WORKGROUP_TURNS,
            localStorageSnapshot: payload.localStorageSnapshot,
        };
        const turnResult = await handleWorkgroupTurn(turnPayload);
        serverLogs.push(...(turnResult.serverLogs || []));
        if (turnResult.error) throw new Error(`Error en turno ${turn} del grupo: ${turnResult.error}`);
        
        conversationHistory = turnResult.updatedHistory;
        if (turnResult.isComplete || turnResult.orchestratorDecision?.nextAgentId === "COMPLETADO") {
          log('INFO', `Grupo de trabajo completó la refactorización en el turno ${turn}.`);
          const finalResponseContent = turnResult.agentResponse?.content || conversationHistory.findLast(m => m.role === 'assistant')?.content;
          if (finalResponseContent) {
            try {
              const cleanedContent = finalResponseContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              const parsedData = JSON.parse(cleanedContent) as RefactorProjectAIResponse;
              if (Array.isArray(parsedData.refactoringSuggestions)) {
                return { success: true, data: parsedData.refactoringSuggestions, workgroupLogs: serverLogs };
              }
              throw new Error("Respuesta final del grupo no tuvo el formato esperado (falta 'refactoringSuggestions').");
            } catch (e) {
              throw new Error(`Error al interpretar la respuesta final del grupo: ${(e as Error).message}. Contenido: ${finalResponseContent.substring(0,200)}...`);
            }
          }
          throw new Error("Grupo finalizó sin respuesta de agente para extraer sugerencias.");
        }
      }
      throw new Error(`Grupo no completó refactorización en ${MAX_WORKGROUP_TURNS} turnos.`);
    } else if (llmOptionsToUse) {
      log('INFO', `Usando llamada directa a LLM para refactorización con proveedor ${llmOptionsToUse.providerId}, modelo ${llmOptionsToUse.modelName}.`);
      
      let systemPromptToUse = systemPromptForDirectCallOrRefactorAgent;
      if (payload.configSource.startsWith('agent:')) {
        const agentId = payload.configSource.split(':')[1];
        const refactorAgent = payload.agents?.find(a => a.id === agentId && a.name === REFACTOR_AGENT_NAME);
        if (refactorAgent) {
            log('INFO', `Utilizando mensaje de sistema del agente ${REFACTOR_AGENT_NAME} para la llamada directa.`);
            systemPromptToUse = `${refactorAgent.systemMessage}\n${refactoringGoals} ${refactoringPriority}\nTu respuesta DEBE seguir el formato JSON con "refactoringSuggestions" como se te indicó.`;
        }
      }

      const messages: ChatMessage[] = [
        { role: "system", content: systemPromptToUse },
        { role: "user", content: `Proyecto (contenido textual):\n\n${projectContent.substring(0, 15000)} ${projectContent.length > 15000 ? "\n... (contenido truncado)" : ""}` }
      ];
      
      const response = await analyzeProjectSourceChunk(
          projectContent, 
          { ...llmOptionsToUse, timeoutMs: REFACTOR_LLM_API_TIMEOUT_MS }, 
          `Refactorización solicitada. ${refactoringGoals} ${refactoringPriority}. El prompt del sistema detallado ya ha sido proporcionado.`
      );
      
      const aiResponse = response as unknown as RefactorProjectAIResponse;

      if (aiResponse && Array.isArray(aiResponse.refactoringSuggestions)) {
        log('INFO', 'Respuesta de refactorización directa recibida y parseada correctamente.');
        return { success: true, data: aiResponse.refactoringSuggestions, workgroupLogs: serverLogs };
      } else if (response.suggestions && response.analysisTitle) { 
        log('WARN', 'La respuesta directa de LLM se parseó como ProjectAnalysisResponse, mapeando a formato de refactorización.');
        const mappedSuggestions: RefactoringSuggestionItem[] = response.suggestions.map(s => ({
          area: s.area,
          description: s.suggestion,
          priority: s.priority || 'Media',
          suggestedSnippet: s.suggestedFullFileContent,
        }));
        return { success: true, data: mappedSuggestions, workgroupLogs: serverLogs };
      } else {
          log('ERROR', 'La respuesta del LLM no contenía sugerencias de refactorización válidas en el formato esperado.', {response});
          throw new Error("La respuesta del análisis no contenía sugerencias válidas para refactorización en el formato esperado.");
      }
    } else {
        log('ERROR', 'Configuración LLM inválida para iniciar refactorización (ni directa ni de grupo).');
        throw new Error("Configuración LLM inválida para iniciar refactorización.");
    }
  } catch (error) {
    let detailMessage: string;
    if (error instanceof Error) {
        detailMessage = error.message;
    } else {
        detailMessage = typeof error === 'string' ? error : "Ha ocurrido un error desconocido durante la operación de refactorización.";
    }
    if (!detailMessage || detailMessage.trim() === "") {
        detailMessage = "Ha ocurrido un error desconocido o el servidor no proporcionó detalles.";
    }
    log('ERROR', `Error obteniendo sugerencias de refactorización: ${detailMessage}`);
    return { success: false, error: detailMessage, workgroupLogs: serverLogs };
  }
}


// Placeholder for applying a single refactoring suggestion
export interface ApplyRefactoringSuggestionPayload {
  suggestionId: string;
  projectIdentifier: string; 
}

export interface ApplyRefactoringSuggestionResult {
  success: boolean;
  error?: string;
  updatedFileContent?: string;
}

export async function handleApplyRefactoringSuggestion(
  payload: ApplyRefactoringSuggestionPayload
): Promise<ApplyRefactoringSuggestionResult> {
  console.log("TODO: Implementar lógica para aplicar sugerencia de refactorización", payload);
  await new Promise(resolve => setTimeout(resolve, 500));
  // This should eventually interact with fs or a virtual file system
  // For now, it's just a placeholder.
  return { success: true, updatedFileContent: "// Contenido del archivo actualizado (simulado)" };
}
