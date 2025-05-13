// src/app/(app)/refactor-project/actions.ts
'use server';

import type { LLMOptions, ChatMessage } from '@/services/groq';
import { analyzeProjectSourceChunk } from '@/services/groq'; 
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS, REFACTOR_AGENT_NAME } from '@/config/agent-config';
import { resolveLlmOptionsForSource, type LocalStorageSnapshot } from '@/lib/llm-utils';
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
  gitUrl?: string; 
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
const MAX_CHARS_PER_REFACTOR_CHUNK = 7000; 
const INTER_CHUNK_REFACTOR_DELAY_MS = 5000;


export async function handleGetRefactoringSuggestions(
  payload: HandleGetRefactoringSuggestionsPayload
): Promise<HandleGetRefactoringSuggestionsResult> {
  const serverLogs: string[] = [];
  const log = (type: 'INFO' | 'ERROR' | 'DEBUG' | 'WARN', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    let dataStringForLogMessage = '';
    if (data !== undefined) {
        try {
            let dataPreviewString = '';
            if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean' || data === null) {
                dataPreviewString = String(data);
            } else if (data instanceof Error) {
                dataPreviewString = `Error: ${data.message}${data.stack ? `\nStack: ${data.stack}` : ''}`;
            } else {
                dataPreviewString = JSON.stringify(data);
            }
            dataStringForLogMessage = ` | Data: ${dataPreviewString.substring(0, 300)}${dataPreviewString.length > 300 ? '...' : ''}`;
        } catch (e) {
            dataStringForLogMessage = ' | Data: [Contenido no serializable para vista previa del log]';
            console.warn(`[REFACTOR_LOG_SERIALIZATION_ERROR][${timestamp}] Failed to stringify data for log type ${type}, message: ${message}`, e);
        }
    }
    const logMsg = `[${timestamp}] [RefactorProj-${type}] ${message}${dataStringForLogMessage}`;
    console.log(`[${timestamp}] [RefactorProj-${type}] ${message}`, data); 
    serverLogs.push(logMsg); 
  };

  log('INFO', `Iniciando obtención de sugerencias de refactorización. ConfigSource: ${payload.configSource}`);

  let projectContentForLLM: string | undefined = undefined; 
  let sourceDescriptionForLLM = "";

  const agentsForLookup = payload.agents || [];
  const workgroupsForLookup = payload.workgroups || [];
  let llmOptionsToUse: LLMOptions | null = null;
  let workgroupForAnalysis: WorkgroupConfig | undefined;
  let orchestratorAgentConfig: AgentConfig | undefined;

  if (payload.gitUrl) {
    sourceDescriptionForLLM = `el repositorio Git en ${payload.gitUrl}`;
    log('INFO', `Procesando URL de Git: ${payload.gitUrl}. Fuente para LLM: ${sourceDescriptionForLLM}`);
    projectContentForLLM = payload.gitUrl; // Pass URL directly for agent to handle
  } else if (payload.projectFileContent) {
    sourceDescriptionForLLM = `el archivo ${payload.projectFileName || 'subido'}`;
    log('INFO', `Procesando contenido de archivo: ${payload.projectFileName} (${payload.projectFileType}). Fuente para LLM: ${sourceDescriptionForLLM}`);
    projectContentForLLM = payload.projectFileContent; 
    if (!projectContentForLLM) {
      log('ERROR', `Contenido de archivo no proporcionado para análisis de archivo.`);
      return { success: false, error: "Contenido de archivo no proporcionado.", workgroupLogs: serverLogs };
    }
    log('INFO', `Contenido de archivo procesado. Tamaño: ${projectContentForLLM.length}`);
  }
  
  if (projectContentForLLM === undefined) {
    log('ERROR', 'No se proporcionó contenido de proyecto (archivo o URL de Git válidos).');
    return { success: false, error: "Fuente del proyecto no especificada o no procesable.", workgroupLogs: serverLogs };
  }

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
    llmOptionsToUse = payload.llmOptions || resolveLlmOptionsForSource(payload.configSource, agentsForLookup, workgroupsForLookup, payload.localStorageSnapshot);
    if (!llmOptionsToUse) {
      log('ERROR', `Configuración LLM para '${payload.configSource}' no pudo ser resuelta o proporcionada.`);
      return { success: false, error: `Configuración LLM para '${payload.configSource}' no pudo ser resuelta o proporcionada.`, workgroupLogs: serverLogs };
    }
  }

  const refactoringGoals = payload.goals ? `Metas de refactorización: "${payload.goals}".` : "Metas de refactorización generales: mejorar claridad, eficiencia y mantenibilidad.";
  const refactoringPriority = payload.priority ? `Prioridad general: "${payload.priority}".` : "";

  const systemPromptForLLM = `Eres un agente experto en refactorización de código. Analiza el siguiente proyecto y genera una lista de sugerencias de refactorización.
${refactoringGoals} ${refactoringPriority}
Si la entrada del usuario es una URL de un repositorio Git (ej: "Por favor, obtén y analiza el código fuente del repositorio Git en la siguiente URL: https://..."), primero obtén el contenido completo de ese repositorio. Luego, procede con el análisis del código obtenido.
Si la entrada del usuario es un fragmento de código o el contenido de un archivo directamente, analízalo.

Tu respuesta DEBE ser un objeto JSON con la clave "refactoringSuggestions", que es un array de objetos. Cada objeto de sugerencia debe tener:
- "area": (string) El archivo/ruta relevante (ej: "src/components/MyComponent.tsx"). Si el input es un fragmento, indica que es parte de un archivo más grande o un fragmento general. Para repositorios Git, usa rutas relativas desde la raíz del repo.
- "description": (string) Una descripción clara de la mejora propuesta.
- "priority": (string) "Alta", "Media", o "Baja".
- "suggestedSnippet": (string, opcional) Un fragmento de código que ilustra el cambio. Si el cambio es conceptual o abarca múltiples áreas, este campo puede omitirse.
No incluyas markdown ni texto introductorio/conclusivo fuera del JSON. Si el texto de entrada es un fragmento, las sugerencias deben ser sobre ese fragmento. Todas las descripciones y sugerencias deben estar en castellano.`;
  
  const taskForWorkgroup = `Analizar ${sourceDescriptionForLLM} para refactorización. ${refactoringGoals} ${refactoringPriority}
${payload.gitUrl
    ? `El proyecto se encuentra en la URL de Git: ${payload.gitUrl}. El agente ${REFACTOR_AGENT_NAME} (o uno similar con capacidad de acceso a Git y análisis de código) debe ser instruido para obtener el código de esta URL y realizar el análisis.`
    : `El proyecto es (contenido textual):\n${projectContentForLLM.substring(0, 15000)} ${projectContentForLLM.length > 15000 ? "\\n... (contenido truncado para el prompt inicial del orquestador)" : ""}`
}
La respuesta final de un agente especialista en refactorización (probablemente ${REFACTOR_AGENT_NAME}) DEBE ser un objeto JSON con la clave "refactoringSuggestions" como se describe en el prompt del sistema del ${REFACTOR_AGENT_NAME}. Todas las descripciones y sugerencias deben estar en castellano.
El Orquestrador debe guiar el flujo para que ${REFACTOR_AGENT_NAME} reciba la tarea y el código/referencia para analizar.`;

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

      let conversationHistory: ChatMessage[] = [{role: 'user', content: taskForWorkgroup}];

      for (let turn = 1; turn <= MAX_WORKGROUP_TURNS; turn++) {
        log('INFO', `Procesando turno de grupo ${turn}/${MAX_WORKGROUP_TURNS} para refactorización.`);
        const turnPayload: WorkgroupTurnPayload = {
            workgroupName: workgroupForAnalysis.name, task: taskForWorkgroup, 
            conversationHistory,
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
      
      let actualContentToAnalyze = projectContentForLLM!;

      if (payload.gitUrl) {
        log('INFO', `Obteniendo contenido desde Git URL para análisis directo: ${payload.gitUrl}`);
        const gitResult = await fetchRepositoryContents(payload.gitUrl);
        if (gitResult.logsBuilt) serverLogs.push(...gitResult.logsBuilt.map(l => `[GIT_FETCH_LOG] ${l}`));
        if (!gitResult.success || !gitResult.concatenatedSource) {
          log('ERROR', `No se pudo obtener el contenido del repositorio Git para análisis directo: ${gitResult.error}`, gitResult);
          throw new Error(String(gitResult.error || "Fallo al obtener contenido de Git para análisis directo."));
        }
        actualContentToAnalyze = gitResult.concatenatedSource;
        log('INFO', `Contenido Git obtenido para análisis directo. Tamaño: ${actualContentToAnalyze.length}`);
      }


      const allSuggestions: RefactoringSuggestionItem[] = [];
      const chunks: string[] = [];
      
      if (actualContentToAnalyze.length > MAX_CHARS_PER_REFACTOR_CHUNK) {
        log('INFO', `El contenido del proyecto (${actualContentToAnalyze.length} caracteres) excede el límite por fragmento (${MAX_CHARS_PER_REFACTOR_CHUNK}). Se dividirá en fragmentos.`);
        for (let i = 0; i < actualContentToAnalyze.length; i += MAX_CHARS_PER_REFACTOR_CHUNK) {
          chunks.push(actualContentToAnalyze.substring(i, i + MAX_CHARS_PER_REFACTOR_CHUNK));
        }
        log('INFO', `Proyecto dividido en ${chunks.length} fragmentos.`);
      } else {
        chunks.push(actualContentToAnalyze);
        log('INFO', `El contenido del proyecto (${actualContentToAnalyze.length} caracteres) es suficientemente pequeño para una sola llamada/fragmento.`);
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        log('DEBUG', `Procesando fragmento ${i + 1}/${chunks.length} para refactorización. Tamaño: ${chunk.length}`);
        
        // For direct LLM calls, the system prompt is defined here and used by makeLLMRequest.
        // The `analyzeProjectSourceChunk` function itself also defines a system prompt,
        // so it's better to call that for consistency if it matches the desired output.
        // However, `analyzeProjectSourceChunk` is more for general analysis.
        // For refactoring, we use `makeLLMRequest` with a specific refactoring prompt.
        const messagesForChunk: ChatMessage[] = [
          { role: "system", content: systemPromptForLLM }, // systemPromptForLLM already requests Spanish.
          { role: "user", content: `Analiza el siguiente FRAGMENTO de código para refactorización (es parte de un proyecto más grande, considera esto al sugerir áreas):\n\n${chunk}` }
        ];
        
        const chunkResult = await analyzeProjectSourceChunk(
          chunk, // Pass the chunk content
          {...llmOptionsToUse, timeoutMs: REFACTOR_LLM_API_TIMEOUT_MS},
          // The preferences string can also include the language instruction if needed.
          // For analyzeProjectSourceChunk, the system prompt inside already asks for Spanish.
          `Analiza este fragmento para refactorización. ${refactoringGoals} ${refactoringPriority}. El fragmento es ${i+1} de ${chunks.length}. Todas las sugerencias deben estar en castellano.`
        );


        if (chunkResult && Array.isArray(chunkResult.suggestions)) {
          log('INFO', `Fragmento ${i + 1} procesado. ${chunkResult.suggestions.length} sugerencias encontradas.`);
          allSuggestions.push(...chunkResult.suggestions.map(s => ({...s, area: s.area + ` (Fragmento ${i+1}/${chunks.length})` })));
        } else {
          log('WARN', `Fragmento ${i + 1} no devolvió sugerencias válidas o tuvo un error. Respuesta:`, chunkResult);
        }

        if (i < chunks.length - 1) {
          log('INFO', `Esperando ${INTER_CHUNK_REFACTOR_DELAY_MS / 1000}s antes del siguiente fragmento.`);
          await new Promise(resolve => setTimeout(resolve, INTER_CHUNK_REFACTOR_DELAY_MS));
        }
      }
      log('INFO', `Procesamiento directo completado. Total de sugerencias: ${allSuggestions.length}`);
      return { success: true, data: allSuggestions, workgroupLogs: serverLogs };
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
    log('ERROR', `Error obteniendo sugerencias de refactorización: ${detailMessage}.`, { stack: (error as Error)?.stack });
    return { success: false, error: String(detailMessage || "Error desconocido."), workgroupLogs: serverLogs };
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

// This function remains simulated as per current scope for external projects.
export async function handleApplyRefactoringSuggestion(
  payload: ApplyRefactoringSuggestionPayload
): Promise<ApplyRefactoringSuggestionResult> {
  console.log("[SIMULATED] Aplicando sugerencia de refactorización:", payload);
  await new Promise(resolve => setTimeout(resolve, 500));
  // In a real scenario, this would involve file system operations or Git operations
  // if the project source was a Git repository.
  return { success: true, updatedFileContent: "// Contenido del archivo actualizado (simulado para proyecto externo)" };
}

