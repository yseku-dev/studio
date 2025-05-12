
'use server';

import type { LLMOptions, ChatMessage, ChatLLMPayload, ChatLLMResponse as ChatResponse } from '@/services/groq';
import { chatWithLLM } from '@/services/groq'; // Use the generic LLM chat function
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';

export interface ChatCompletionResponse {
  success: boolean;
  data?: ChatResponse; // Use generic response type
  error?: string;
}

const LLM_API_TIMEOUT_MS_CHAT = 90000; // 90 segundos para chat

export async function handleChatCompletion(
  messages: ChatMessage[],
  providerId: LLMProviderId, // Expect providerId
  apiKey: string,
  modelName: string,
  apiUrl?: string // Optional API URL for local LLMs
): Promise<ChatCompletionResponse> {

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
   if (!messages || messages.length === 0) {
    return { success: false, error: "Se requiere al menos un mensaje para iniciar el chat." };
  }

  const llmOptions: LLMOptions = {
    providerId: currentProvider.id,
    apiKey,
    modelName,
    apiUrl: apiUrl || currentProvider.apiUrl,
    timeoutMs: LLM_API_TIMEOUT_MS_CHAT,
  };
  
  const payload: ChatLLMPayload = {
    messages,
    options: llmOptions,
  };

  const operationName = `la respuesta del chat con ${currentProvider.name}`;
  try {
    const result = await chatWithLLM(payload);
    return { success: true, data: result };
  } catch (error) {
    console.error(`Error en ${operationName}:`, error); 
    
    let detailMessage: string;
    if (error instanceof Error) {
        detailMessage = error.message;
        if (detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
          detailMessage = `La solicitud de chat excedió el tiempo límite de ${LLM_API_TIMEOUT_MS_CHAT / 1000} segundos. Intenta con un mensaje más corto o revisa la conexión.`;
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
