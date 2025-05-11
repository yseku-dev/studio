// src/app/(app)/refactor-project/actions.ts
'use server';

import type { LLMOptions, ChatMessage } from '@/services/groq';
// Assuming a generic service function similar to others for project-wide analysis
import { analyzeProjectSourceChunk } from '@/services/groq'; 
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import { handleWorkgroupTurn, type WorkgroupTurnPayload, type WorkgroupTurnResponse } from '@/app/(app)/workgroups/actions';
import { ORCHESTRATOR_AGENT_NAME, MAX_WORKGROUP_TURNS } from '@/config/agent-config';
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
    // Simulate processing based on type, actual ZIP/JSON parsing would be more complex
    if (payload.projectFileType === 'application/json' || payload.projectFileName?.endsWith('.json')) {
        projectContent = payload.projectFileContent;
        log('INFO', `Contenido JSON procesado. Tamaño: ${projectContent.length}`);
    } else if (payload.projectFileType === 'application/zip' || payload.projectFileName?.endsWith('.zip')) {
         log('WARN', 'Procesamiento de ZIP (desde contenido string) aún no implementado. Usando placeholder con nombre de archivo.');
         // For actual ZIP processing from content, you'd need a library that handles ArrayBuffer/Uint8Array.
         // This simulation assumes the content might be textual or a placeholder instruction.
         projectContent = `// Contenido del proyecto ZIP (simulado a partir de string) para ${payload.projectFileName} - Implementar descompresión y concatenación si el contenido es el binario.`;
    } else if (payload.projectFileType?.startsWith('text/')) {
        projectContent = payload.projectFileContent;
        log('INFO', `Contenido de archivo de texto (${payload.projectFileName}) procesado. Tamaño: ${projectContent.length}`);
    } else {
        log('ERROR', `Tipo de archivo no soportado o contenido no textual: ${payload.projectFileName} (${payload.projectFileType})`);
        return { success: false, error: `Tipo de archivo no soportado o no es procesable como texto: ${payload.projectFileName}`, workgroupLogs: serverLogs };
    }
  } else if (payload.gitUrl) {
    log('INFO', `Procesando URL de Git: ${payload.gitUrl} (Simulado)`);
    // TODO: Implement Git clone and content extraction (complex, simulate for now)
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
      return { success: false, error: `Grupo de trabajo '${workgroupId}' no encontrado.`, workgroupLogs: serverLogs };
    }
    orchestratorAgentConfig = payload.agents?.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroupForAnalysis.agentIds.includes(a.id));
    if (!orchestratorAgentConfig) {
      return { success: false, error: `Agente Orquestador no encontrado en el grupo '${workgroupForAnalysis.name}'.`, workgroupLogs: serverLogs };
    }
  } else {
     llmOptionsToUse = resolveLlmOptionsForSource(payload.configSource, payload.agents || [], payload.workgroups || [], payload.localStorageSnapshot);
  }

  if (!llmOptionsToUse && !workgroupForAnalysis) {
    return { success: false, error: `Configuración LLM para '${payload.configSource}' no pudo ser resuelta.`, workgroupLogs: serverLogs };
  }

  // --- Construct Prompt / Task ---
  const refactoringGoals = payload.goals ? `Metas de refactorización: "${payload.goals}".` : "Metas de refactorización generales: mejorar claridad, eficiencia y mantenibilidad.";
  const refactoringPriority = payload.priority ? `Prioridad general: "${payload.priority}".` : "";

  const systemPromptForDirectCall = `Eres un agente experto en refactorización de código. Analiza el siguiente proyecto (archivos concatenados o JSON) y genera una lista de sugerencias de refactorización.
${refactoringGoals} ${refactoringPriority}
Tu respuesta DEBE ser un objeto JSON con la clave "refactoringSuggestions", que es un array de objetos. Cada objeto de sugerencia debe tener:
- "area": (string) El archivo/ruta relevante (ej: "src/components/MyComponent.tsx").
- "description": (string) Una descripción clara de la mejora propuesta.
- "priority": (string) "Alta", "Media", o "Baja".
- "suggestedSnippet": (string, opcional) Un fragmento de código que ilustra el cambio.
No incluyas markdown ni texto introductorio/conclusivo fuera del JSON.`;

  const taskForWorkgroup = `Analizar el siguiente proyecto para refactorización. ${refactoringGoals} ${refactoringPriority}
El proyecto es (contenido textual):
${projectContent.substring(0, 15000)} ${projectContent.length > 15000 ? "\n... (contenido truncado para el prompt)" : ""}
La respuesta final de un agente especialista en refactorización DEBE ser un objeto JSON con la clave "refactoringSuggestions" como se describe en el prompt del sistema del Refactorizador.`;


  // --- Call LLM (Directly or via Workgroup) ---
  try {
    if (workgroupForAnalysis && orchestratorAgentConfig && payload.agents && payload.localStorageSnapshot) {
      log('INFO', `Usando grupo de trabajo "${workgroupForAnalysis.name}" para refactorización.`);
      
      const orchestratorLlmOptions = resolveLlmOptionsForSource(`agent:${orchestratorAgentConfig.id}`, payload.agents, payload.workgroups || [], payload.localStorageSnapshot);
      if (!orchestratorLlmOptions) {
        return { success: false, error: `Configuración LLM inválida para Orquestador en grupo '${workgroupForAnalysis.name}'.`, workgroupLogs: serverLogs };
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
      log('INFO', `Usando llamada directa a LLM para refactorización con proveedor ${llmOptionsToUse.providerId}.`);
      const messages: ChatMessage[] = [
        { role: "system", content: systemPromptForDirectCall },
        { role: "user", content: `Proyecto (contenido textual):\n\n${projectContent.substring(0, 15000)} ${projectContent.length > 15000 ? "\n... (contenido truncado)" : ""}` }
      ];

      const response = await analyzeProjectSourceChunk(projectContent, { ...llmOptionsToUse, timeoutMs: REFACTOR_LLM_API_TIMEOUT_MS }, 
        `Metas: ${payload.goals || 'generales'}. Prioridad: ${payload.priority || 'ninguna'}. Prompt del sistema para refactorización usado internamente.`
      );
      
      if (response.suggestions) {
        const mappedSuggestions: RefactoringSuggestionItem[] = response.suggestions.map(s => ({
          area: s.area,
          description: s.suggestion,
          priority: s.priority || 'Media',
          suggestedSnippet: s.suggestedFullFileContent,
        }));
        return { success: true, data: mappedSuggestions, workgroupLogs: serverLogs };
      } else {
          throw new Error("La respuesta del análisis no contenía sugerencias válidas para refactorización.");
      }
    } else {
        throw new Error("Configuración LLM inválida para iniciar refactorización.");
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido durante la refactorización.";
    log('ERROR', `Error obteniendo sugerencias de refactorización: ${errorMsg}`);
    return { success: false, error: errorMsg, workgroupLogs: serverLogs };
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
  return { success: true, updatedFileContent: "// Contenido del archivo actualizado (simulado)" };
}
