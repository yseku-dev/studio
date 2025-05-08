
'use server';

import type { LLMOptions } from '@/services/groq';
import { generateCodeFromPrompt as callLLMToGenerateCode } from '@/services/groq'; // Renamed import
import { GeneratedCodeResponse as GeneratedCodeLLMResponse } from '@/services/groq'; // Use generic type from service
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';

// Re-exporting the type from the service for consistency in the action interface
export type GeneratedCodeData = GeneratedCodeLLMResponse;

export interface HandleGenerateCodeResult {
  success: boolean;
  data?: GeneratedCodeData;
  error?: string;
}

const LLM_API_TIMEOUT_MS_GENERATE_CODE = 90000; // 90 segundos para generación de código

export async function handleGenerateCode(
  prompt: string,
  providerId: LLMProviderId, // Expect providerId
  apiKey: string,
  modelName: string,
  apiUrl?: string // Optional API URL for local LLMs
): Promise<HandleGenerateCodeResult> {

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
    timeoutMs: LLM_API_TIMEOUT_MS_GENERATE_CODE,
  };
  
  try {
    const result = await callLLMToGenerateCode(prompt, llmOptions);
    return { success: true, data: result };
  } catch (error) {
    const operationName = `la generación del código con ${currentProvider.name}`;
    console.error(`Error en ${operationName}:`, error); // Log the raw error
    
    let detailMessage: string;
    if (error instanceof Error) {
        detailMessage = error.message;
        if (detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
          detailMessage = `La generación de código excedió el tiempo límite de ${LLM_API_TIMEOUT_MS_GENERATE_CODE / 1000} segundos. Intenta con un prompt más simple o revisa la conexión.`;
        }
    } else {
        try {
            detailMessage = String(error);
        } catch (e) {
            detailMessage = "Ocurrió un error desconocido.";
        }
    }
    if (!detailMessage && detailMessage !== '') {
        detailMessage = "Ocurrió un error desconocido.";
    } else if (detailMessage === '') {
        detailMessage = "Error sin mensaje detallado.";
    }
    
    return { success: false, error: `Falló ${operationName}: ${detailMessage}` };
  }
}
