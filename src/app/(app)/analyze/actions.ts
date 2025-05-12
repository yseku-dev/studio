
'use server';

import { analyzeCode, type CodeSuggestionResponse, type LLMOptions } from '@/services/groq';
import { LOCALSTORAGE_PROVIDER_ID_KEY, getLocalStorageApiKeyName, getLocalStorageModelName, DEFAULT_LLM_PROVIDER, LLM_PROVIDERS } from '@/config/llm-config'; // Import general LLM config

interface AnalyzeCodeResult {
  success: boolean;
  data?: CodeSuggestionResponse; // Use generic response type
  error?: string;
}

const LLM_API_TIMEOUT_MS_ANALYZE = 60000; // 60 segundos para análisis de código simple

export async function handleAnalyzeCode(
  code: string,
  providerId: string, // Now expects providerId
  apiKey: string,     // Still needs API key directly passed
  modelName: string,   // Still needs model name
  apiUrl?: string      // Optional API URL for local LLMs
): Promise<AnalyzeCodeResult> {
  
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
    apiUrl: apiUrl || currentProvider.apiUrl, // Use provided apiUrl or default from provider config
    timeoutMs: LLM_API_TIMEOUT_MS_ANALYZE,
  };
  
  const operationName = `el análisis del código con ${currentProvider.name}`;
  try {
    // Call the generic analyzeCode function
    const result = await analyzeCode(code, llmOptions);
    return { success: true, data: result };
  } catch (error) {
    console.error(`Error en ${operationName}:`, error); 
    
    let detailMessage: string;
    if (error instanceof Error) {
        detailMessage = error.message;
        if (detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
          detailMessage = `El análisis del código excedió el tiempo límite de ${LLM_API_TIMEOUT_MS_ANALYZE / 1000} segundos. Intenta con un fragmento más pequeño o revisa la conexión.`;
        }
    } else {
        detailMessage = typeof error === 'string' ? error : "Ha ocurrido un error desconocido durante la operación.";
    }
    
    if (!detailMessage || detailMessage.trim() === "") {
        detailMessage = "Ha ocurrido un error desconocido o el servidor no proporcionó detalles.";
    }
    
    return { success: false, error: `Falló ${operationName}: ${detailMessage}` };
  }
}
