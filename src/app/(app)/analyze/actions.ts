// src/app/(app)/analyze/actions.ts
'use server';

import { analyzeCode, type CodeSuggestionResponse, type LLMOptions } from '@/services/groq';
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config'; 

interface AnalyzeCodeResult {
  success: boolean;
  data?: CodeSuggestionResponse; 
  error?: string;
}

const LLM_API_TIMEOUT_MS_ANALYZE = 60000; 

export async function handleAnalyzeCode(
  code: string,
  providerId: LLMProviderId, 
  apiKey: string,     
  modelName: string,   
  apiUrl?: string      
): Promise<AnalyzeCodeResult> {
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


    const llmOptions: LLMOptions = {
      providerId: currentProvider.id,
      apiKey,
      modelName,
      apiUrl: apiUrl || currentProvider.apiUrl, 
      timeoutMs: LLM_API_TIMEOUT_MS_ANALYZE,
    };
    
    const operationName = `el análisis del código con ${currentProvider.name}`;
    const result = await analyzeCode(code, llmOptions);
    return { success: true, data: result };
  } catch (error) {
    const err = error as Error;
    console.error(`Error en handleAnalyzeCode: ${err.message}`, {stack: err.stack}); 
    
    let detailMessage: string = err.message;
    if (detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
      detailMessage = `El análisis del código excedió el tiempo límite de ${LLM_API_TIMEOUT_MS_ANALYZE / 1000} segundos. Intenta con un fragmento más pequeño o revisa la conexión.`;
    } else if (!detailMessage || detailMessage.trim() === "") {
        detailMessage = "Ha ocurrido un error desconocido durante la operación.";
    }
    
    return { success: false, error: `Falló el análisis de código: ${detailMessage}` };
  }
}

