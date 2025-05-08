// src/app/(app)/agents/actions.ts
'use server';

import type { LLMOptions, ChatMessage, ChatLLMResponse as ChatResponse } from '@/services/groq';
import { chatWithLLM } from '@/services/groq'; // Use the generic LLM chat function
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';

export interface AgentChatCompletionResponse {
  success: boolean;
  data?: ChatResponse; // Use generic response type
  error?: string;
}

const AGENT_CHAT_TIMEOUT_MS = 90000; // 90 seconds for agent chat test

export async function handleAgentChatCompletion(
  systemMessage: string,
  messages: ChatMessage[],
  llmOptions: LLMOptions // Expect resolved LLMOptions from the client
): Promise<AgentChatCompletionResponse> {

  // Validate received LLM options
  const currentProvider = LLM_PROVIDERS.find(p => p.id === llmOptions.providerId);
  if (!currentProvider) {
    return { success: false, error: `Proveedor LLM '${llmOptions.providerId}' no encontrado.` };
  }
  if (currentProvider.requiresApiKey && !llmOptions.apiKey) {
    return { success: false, error: `La clave API para ${currentProvider.name} es obligatoria.` };
  }
  if (!llmOptions.modelName) {
     return { success: false, error: `El nombre del modelo para ${currentProvider.name} es obligatorio.` };
  }
   if (!messages || messages.length === 0) {
    return { success: false, error: "Se requiere al menos un mensaje de usuario para iniciar el chat de prueba." };
  }

  // Prepend the agent's specific system message
  const messagesForApi: ChatMessage[] = [
    { role: 'system', content: systemMessage },
    ...messages // User messages
  ];

  const payload = {
    messages: messagesForApi,
    options: {
        ...llmOptions, // Use the resolved options passed from client
        timeoutMs: llmOptions.timeoutMs || AGENT_CHAT_TIMEOUT_MS // Ensure timeout is set
    },
  };

  try {
    console.log(`[Agent Test] Calling chatWithLLM for agent with provider: ${llmOptions.providerId}, model: ${llmOptions.modelName}`);
    const result = await chatWithLLM(payload);
    return { success: true, data: result };
  } catch (error) {
    const operationName = `la respuesta del chat de prueba del agente con ${currentProvider.name}`;
    console.error(`Error en ${operationName}:`, error);

    let detailMessage: string;
    if (error instanceof Error) {
        detailMessage = error.message;
        if (detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
          detailMessage = `La solicitud de chat de prueba excedió el tiempo límite de ${AGENT_CHAT_TIMEOUT_MS / 1000} segundos.`;
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

    