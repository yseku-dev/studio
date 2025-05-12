// src/app/(app)/refactor-project/actions.ts
'use server';

import type { LLMOptions, ChatMessage } from '@/services/groq';
import { analyzeProjectSourceChunk } from '@/services/groq'; 
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AgentConfig, WorkgroupConfig, AgentLLMConfig } from '@/types/agent';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS, REFACTOR_AGENT_NAME } from '@/config/agent-config';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
import fs from 'fs/promises'; 
import path from 'path'; 
import { fetchRepositoryContents } from '@/services/git-service';


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
  projectFileContent?: string; 
  projectFileName?: string;    
  projectFileType?: string;    
  gitUrl?: string; // Added for Git URL
  goals?: string;
  priority?: "seguridad" | "legibilidad" | "rendimiento" | "estandarizar" | "reducir_complejidad";
  configSource: string; 
  llmOptions?: LLMOptions; 
  agents?: AgentConfig[];
  workgroups?: WorkgroupConfig[];
  localStorageSnapshot?: LocalStorageSnapshot;
}

export interface HandleGetRefactoringSuggestionsResult {
  success: boolean;
  data?: RefactoringSuggestionItem[];
  error?: string;
  workgroupLogs?: string[];
}

const REFACTOR_LLM_API_TIMEOUT_MS = 180000;


export async function handleGetRefactoringSuggestions(
  payload: HandleGetRefactoringSuggestionsPayload
): Promise<HandleGetRefactoringSuggestionsResult> {
  const serverLogs: string[] = [];
  const log = (type: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
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
            console.warn(`[REFACTOR_LOG_SERIALIZATION_ERROR][${timestamp}] Failed to stringify data for log type ${type}, message: ${message}`, e);
        }
    }
    const logMsg = `[${timestamp}] [RefactorProj-${type}] ${message}${dataStringForLogMessage}`;
    console.log(`[${timestamp}] [RefactorProj-${type}] ${message}`, data); 
    serverLogs.push(logMsg);
  };

  log('INFO', `Iniciando obtención de sugerencias de refactorización.`);

  let projectContent: string | undefined = undefined;
  let sourceDescriptionForLLM = "";

  if (payload.gitUrl) {
    log('INFO', `Procesando URL de Git: ${payload.gitUrl}`);
    sourceDescriptionForLLM = `el repositorio Git en ${payload.gitUrl}`;
    const gitResult = await fetchRepositoryContents(payload.gitUrl);
    serverLogs.push(...(gitResult.logsBuilt || []));
    if (!gitResult.success || !gitResult.concatenatedSource) {
      log('ERROR', `No se pudo obtener el contenido del repositorio Git: ${gitResult.error}`);
      return { success: false, error: `No se pudo obtener el contenido del repositorio Git: ${gitResult.error || 'Error desconocido.'}`, workgroupLogs: serverLogs };
    }
    projectContent = gitResult.concatenatedSource;
    log('INFO', `Contenido del repositorio Git obtenido. Tamaño concatenado: ${projectContent.length}`);
  } else if (payload.projectFileContent) {
    sourceDescriptionForLLM = `el archivo ${payload.projectFileName || 'subido'}`;
    log('INFO', `Procesando contenido de archivo: ${payload.projectFileName} (${payload.projectFileType})`);
    projectContent = payload.projectFileContent; 
    if (projectContent) {
      log('INFO', `Contenido de archivo procesado. Tamaño: ${projectContent.length}`);
    } else {
      log('ERROR', `Contenido de archivo no proporcionado para análisis de archivo.`);
      return { success: false, error: "Contenido de archivo no proporcionado.", workgroupLogs: serverLogs };
    }
  }
  
  if (projectContent === undefined) {
    log('ERROR', 'No se proporcionó contenido de archivo ni URL de Git válidos.');
    return { success: false, error: "Fuente del proyecto no especificada o no procesable.", workgroupLogs: serverLogs };
  }

  let llmOptionsToUse: LLMOptions | null = null;
  let workgroupForAnalysis: WorkgroupConfig | undefined;
  let orchestratorAgentConfig: AgentConfig | undefined;

  const agentsForLookup = payload.agents || [];
  const workgroupsForLookup = payload.workgroups || [];

  if (payload.configSource.startsWith('workgroup:')) {
    const workgroupId = payload.configSource.split(':')[1];
    workgroupForAnalysis = workgroupsForLookup.find(wg => wg.id === workgroupId);
    if (!workgroupForAnalysis) {
      log('ERROR', `Grupo de trabajo con ID ${workgroupId} no encontrado.`);
      return { success: false, error: `Grupo de trabajo '${workgroupId}' no encontrado.`, workgroupLogs: serverLogs };
    }
    const orchestratorIdInGroup = workgroupForAnalysis.agentIds.find(agentId => {
        const agent = agentsForLookup.find(a => a.id === agentId);
        return agent?.name === ORCHESTRATOR_AGENT_NAME;
    });
    orchestratorAgentConfig = agentsForLookup.find(a => a.id === orchestratorIdInGroup);
    
    if (!orchestratorAgentConfig) {
      log('ERROR', `Agente Orquestador no encontrado en el grupo '${workgroupForAnalysis.name}'.`);
      return { success: false, error: `Agente Orquestador no encontrado en el grupo '${workgroupForAnalysis.name}'.`, workgroupLogs: serverLogs };
    }
  } else {
    if (payload.llmOptions) {
        llmOptionsToUse = payload.llmOptions;
        log('INFO', `Usando opciones LLM pasadas directamente: ${llmOptionsToUse.providerId} - ${llmOptionsToUse.modelName}`);
    } else {
        log('DEBUG', `Opciones LLM no proporcionadas para llamada directa (configSource: ${payload.configSource}). Intentando resolución en servidor.`);
        llmOptionsToUse = resolveLlmOptionsForSource(payload.configSource, agentsForLookup, workgroupsForLookup, payload.localStorageSnapshot);
    }
  }

  if (!llmOptionsToUse && !workgroupForAnalysis) {
    log('ERROR', `Configuración LLM para '${payload.configSource}' no pudo ser resuelta o proporcionada, y no es un grupo de trabajo válido.`);
    return { success: false, error: `Configuración LLM para '${payload.configSource}' no pudo ser resuelta o proporcionada.`, workgroupLogs: serverLogs };
  }

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

  const taskForWorkgroup = `Analizar ${sourceDescriptionForLLM} para refactorización. ${refactoringGoals} ${refactoringPriority}
El proyecto es (contenido textual):
${projectContent.substring(0, 15000)} ${projectContent.length > 15000 ? "\\n... (contenido truncado para el prompt)" : ""}
La respuesta final de un agente especialista en refactorización (probablemente ${REFACTOR_AGENT_NAME}) DEBE ser un objeto JSON con la clave "refactoringSuggestions" como se describe en el prompt del sistema del ${REFACTOR_AGENT_NAME}.
El Orquestador debe guiar el flujo para que ${REFACTOR_AGENT_NAME} reciba la tarea y el código para analizar.`;

  try {
    if (workgroupForAnalysis && orchestratorAgentConfig && payload.localStorageSnapshot) {
      log('INFO', `Usando grupo de trabajo "${workgroupForAnalysis.name}" para refactorización.`);
      
      const orchestratorLlmOptions = resolveLlmOptionsForSource(`agent:${orchestratorAgentConfig.id}`, agentsForLookup, workgroupsForLookup, payload.localStorageSnapshot);
      if (!orchestratorLlmOptions) {
        log('ERROR', `Configuración LLM inválida para Orquestrador (${orchestratorAgentConfig.name}) en grupo ${workgroupForAnalysis.name}.`);
        throw new Error(`Configuración LLM inválida para Orquestrador en grupo '${workgroupForAnalysis.name}'.`);
      }
      
      orchestratorLlmOptions.providerId = (orchestratorAgentConfig.llmConfig !== 'default' ? orchestratorAgentConfig.llmConfig.providerId : orchestratorLlmOptions.providerId);
      orchestratorLlmOptions.modelName = (orchestratorAgentConfig.llmConfig !== 'default' ? orchestratorAgentConfig.llmConfig.modelName : orchestratorLlmOptions.modelName);
      orchestratorLlmOptions.apiKey = (orchestratorAgentConfig.llmConfig !== 'default' ? orchestratorAgentConfig.llmConfig.apiKey : orchestratorLlmOptions.apiKey) || '';
      orchestratorLlmOptions.apiUrl = (orchestratorAgentConfig.llmConfig !== 'default' ? orchestratorAgentConfig.llmConfig.apiUrl : orchestratorLlmOptions.apiUrl);

      const participantAgentConfigs = workgroupForAnalysis.agentIds
        .filter(id => id !== orchestratorAgentConfig!.id)
        .map(id => agentsForLookup.find(a => a.id === id))
        .filter(agent => agent !== undefined)
        .reduce((acc, agent) => {
          const options = resolveLlmOptionsForSource(`agent:${agent!.id}`, agentsForLookup, workgroupsForLookup, payload.localStorageSnapshot!);
          if (options) {
            acc[agent!.id] = {
              id: agent!.id, name: agent!.name, systemMessage: agent!.systemMessage,
              llmProviderId: options.providerId, llmModelName: options.modelName,
              llmApiKey: options.apiKey, llmApiUrl: options.apiUrl
            };
          } else {
            log('WARN', `Configuración LLM inválida para agente participante ${agent!.name}, será omitido.`);
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
        const refactorAgent = agentsForLookup.find(a => a.id === agentId && a.name === REFACTOR_AGENT_NAME);
        if (refactorAgent) {
            log('INFO', `Utilizando mensaje de sistema del agente ${REFACTOR_AGENT_NAME} para la llamada directa.`);
            systemPromptToUse = `${refactorAgent.systemMessage}\\n${refactoringGoals} ${refactoringPriority}\\nTu respuesta DEBE seguir el formato JSON con "refactoringSuggestions" como se te indicó.`;
        }
      }
      
      const messagesForDirectRefactor: ChatMessage[] = [
        { role: "system", content: systemPromptToUse },
        { role: "user", content: `Analiza ${sourceDescriptionForLLM} para refactorización. Contenido del proyecto:\\n\\n${projectContent.substring(0, 25000)} ${projectContent.length > 25000 ? "\\n... (contenido truncado para el prompt)" : ""}` }
      ];

      // Using analyzeProjectSourceChunk as it expects a JSON response similar to RefactorProjectAIResponse.
      // We might need to adjust the prompt slightly or create a dedicated service function if the structure is too different.
      const refactorLLMResponse = await analyzeProjectSourceChunk(
        projectContent, // Send the full (or chunked) content here
        {...llmOptionsToUse, timeoutMs: REFACTOR_LLM_API_TIMEOUT_MS},
        systemPromptToUse // The prompt is already well-defined for getting suggestions
      );
      
      // The analyzeProjectSourceChunk returns ProjectAnalysisResponse. We need to adapt it or ensure REFACTOR_AGENT_NAME returns this format.
      // For now, let's assume the output is directly usable or the REFACTOR_AGENT_NAME prompt makes it so.
      if (refactorLLMResponse && Array.isArray(refactorLLMResponse.suggestions)) {
        log('INFO', 'Respuesta de refactorización directa recibida y parseada correctamente (adaptada de analyzeProjectSourceChunk).');
        // Adapt ProjectAnalysisResponse.suggestions to RefactoringSuggestionItem[]
        const adaptedSuggestions: RefactoringSuggestionItem[] = refactorLLMResponse.suggestions.map(s => ({
            area: s.area,
            description: s.suggestion,
            priority: s.priority as 'Alta' | 'Media' | 'Baja' || 'Media', // Cast and provide default
            suggestedSnippet: s.suggestedFullFileContent
        }));
        return { success: true, data: adaptedSuggestions, workgroupLogs: serverLogs };
      } else {
          log('ERROR', 'La respuesta directa del LLM no contenía sugerencias de refactorización válidas en el formato esperado.', {response: refactorLLMResponse});
          throw new Error("La respuesta del LLM no contenía sugerencias válidas para refactorización en el formato esperado (RefactorProjectAIResponse).");
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
  return { success: true, updatedFileContent: "// Contenido del archivo actualizado (simulado)" };
}

