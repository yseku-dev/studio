'use server';

import type { GroqOptions } from '@/services/groq';
import { generateCodeFromPrompt as callGroqToGenerateCode } from '@/services/groq'; // Renamed import

export interface GeneratedCodeData {
  generatedCode: string;
  explanation?: string;
}

export interface GeneratedCodeResponse {
  success: boolean;
  data?: GeneratedCodeData;
  error?: string;
}

const GROQ_API_TIMEOUT_MS_GENERATE_CODE = 90000; // 90 segundos para generación de código

export async function handleGenerateCode(
  prompt: string,
  apiKey: string,
  modelName: string
): Promise<GeneratedCodeResponse> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }

  const groqOptions: GroqOptions = {
    apiKey,
    modelName,
    timeoutMs: GROQ_API_TIMEOUT_MS_GENERATE_CODE,
  };
  
  try {
    const result = await callGroqToGenerateCode(prompt, groqOptions);
    return { success: true, data: result };
  } catch (error) {
    const operationName = "la generación del código";
    console.error(`Error en ${operationName}:`, error);
    let detailMessage = "Ocurrió un error desconocido.";

    if (error instanceof Error) {
        detailMessage = error.message;
        if (error.message.toLowerCase().includes("timeout") || error.message.toLowerCase().includes("excedió el tiempo límite")) {
          detailMessage = `La generación de código excedió el tiempo límite de ${GROQ_API_TIMEOUT_MS_GENERATE_CODE / 1000} segundos. Intenta con un prompt más simple o revisa la conexión.`;
        }
    } else if (typeof error === 'string') {
        detailMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
        detailMessage = (error as any).message;
    }

    return { success: false, error: `Falló ${operationName}: ${detailMessage}` };
  }
}
