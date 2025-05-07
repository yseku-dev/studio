'use server';

import { suggestCodeImprovements, SuggestCodeImprovementsInput, SuggestCodeImprovementsOutput } from '@/ai/flows/suggest-code-improvements';

interface AnalyzeCodeResult {
  success: boolean;
  data?: SuggestCodeImprovementsOutput;
  error?: string;
}

export async function handleAnalyzeCode(
  code: string,
  apiKey: string,
  modelName: string
): Promise<AnalyzeCodeResult> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }

  const input: SuggestCodeImprovementsInput = {
    code,
    groqApiKey: apiKey,
    groqModelName: modelName,
  };

  try {
    // Se espera que el flujo de IA llame al servicio Groq real.
    // La función `analyzeCodeWithGroq` proporcionada en `src/services/groq.ts` es un marcador de posición.
    // Confiamos en que el flujo de IA `suggestCodeImprovements` maneje la llamada real.
    const result = await suggestCodeImprovements(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error analizando el código:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido durante el análisis.";
    return { success: false, error: `Falló el análisis del código: ${errorMessage}` };
  }
}
