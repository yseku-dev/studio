
'use server';

import type { GroqOptions, ChatMessage, ChatGroqPayload, ChatGroqResponse } from '@/services/groq';
import { chatWithGroq } from '@/services/groq';

export interface ChatCompletionResponse {
  success: boolean;
  data?: ChatGroqResponse; // Re-use the response type from the service
  error?: string;
}

const GROQ_API_TIMEOUT_MS_CHAT = 90000; // 90 segundos para chat

export async function handleChatCompletion(
  messages: ChatMessage[],
  apiKey: string,
  modelName: string
): Promise<ChatCompletionResponse> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }
  if (!messages || messages.length === 0) {
    return { success: false, error: "Se requiere al menos un mensaje para iniciar el chat." };
  }

  const groqOptions: GroqOptions = {
    apiKey,
    modelName,
    timeoutMs: GROQ_API_TIMEOUT_MS_CHAT,
  };
  
  const payload: ChatGroqPayload = {
    messages,
    options: groqOptions,
  };

  try {
    const result = await chatWithGroq(payload);
    return { success: true, data: result };
  } catch (error) {
    const operationName = "la respuesta del chat";
    console.error(`Error en ${operationName}:`, error); 
    
    let detailMessage: string;
    if (error instanceof Error) {
        detailMessage = error.message;
        if (detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
          detailMessage = `La solicitud de chat excedió el tiempo límite de ${GROQ_API_TIMEOUT_MS_CHAT / 1000} segundos. Intenta con un mensaje más corto o revisa la conexión.`;
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
