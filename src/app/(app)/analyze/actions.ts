'use server';

import { suggestCodeImprovements, SuggestCodeImprovementsInput, SuggestCodeImprovementsOutput } from '@/ai/flows/suggest-code-improvements';
import type { GroqOptions } from '@/services/groq'; // Import GroqOptions

interface AnalyzeCodeResult {
  success: boolean;
  data?: SuggestCodeImprovementsOutput;
  error?: string;
}

const GROQ_API_TIMEOUT_MS_ANALYZE = 60000; // 60 segundos para análisis de código simple

export async function handleAnalyzeCode(
  code: string,
  apiKey: string,
  modelName: string
): Promise<AnalyzeCodeResult> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }

  const groqOptions: GroqOptions = {
    apiKey,
    modelName,
    timeoutMs: GROQ_API_TIMEOUT_MS_ANALYZE,
  };
  
  const input: SuggestCodeImprovementsInput = {
    code,
    groqOptions, // Pasar el objeto de opciones completo
  };


  try {
    const result = await suggestCodeImprovements(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error analizando el código:", error);
    let errorMessage = "Ocurrió un error desconocido durante el análisis.";
    if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.toLowerCase().includes("timeout") || error.message.toLowerCase().includes("excedió el tiempo límite")) {
          errorMessage = `El análisis del código excedió el tiempo límite de ${GROQ_API_TIMEOUT_MS_ANALYZE / 1000} segundos. Intenta con un fragmento más pequeño o revisa la conexión.`;
        }
    }
    return { success: false, error: `Falló el análisis del código: ${errorMessage}` };
  }
}
