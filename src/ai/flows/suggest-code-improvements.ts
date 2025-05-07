'use server';

/**
 * @fileOverview Proporciona sugerencias para mejorar el código utilizando la API de Groq.
 *
 * - suggestCodeImprovements - Una función que sugiere mejoras de código.
 * - SuggestCodeImprovementsInput - El tipo de entrada para la función suggestCodeImprovements.
 * - SuggestCodeImprovementsOutput - El tipo de retorno para la función suggestCodeImprovements.
 */

import {z} from 'zod'; // Zod sigue siendo útil para la validación de esquemas
import {analyzeCodeWithGroq, GroqOptions, GroqResponse} from '@/services/groq';

const SuggestCodeImprovementsInputSchema = z.object({
  code: z.string().describe('El código a analizar para mejoras.'),
  groqApiKey: z.string().describe('La clave API para acceder al modelo Groq.'),
  groqModelName: z.string().describe('El nombre del modelo Groq a utilizar.'),
});
export type SuggestCodeImprovementsInput = z.infer<typeof SuggestCodeImprovementsInputSchema>;

const SuggestCodeImprovementsOutputSchema = z.object({
  codeSuggestion: z.string().describe('El código mejorado sugerido.'),
  explanation: z.string().describe('La explicación de la mejora sugerida.'),
});
export type SuggestCodeImprovementsOutput = z.infer<typeof SuggestCodeImprovementsOutputSchema>;

// Esta ya no es una función de flujo de Genkit, sino una función de servidor asíncrona normal.
export async function suggestCodeImprovements(input: SuggestCodeImprovementsInput): Promise<SuggestCodeImprovementsOutput> {
  const validationResult = SuggestCodeImprovementsInputSchema.safeParse(input);
  if (!validationResult.success) {
    console.error("Entrada inválida para suggestCodeImprovements:", validationResult.error.format());
    // Considera lanzar un error más específico o devolver una estructura de error.
    throw new Error("Entrada inválida para sugerencias de código.");
  }
  
  const groqOptions: GroqOptions = {
    apiKey: input.groqApiKey,
    modelName: input.groqModelName,
  };

  // Llamada directa a la función de servicio que interactúa con la API de Groq.
  const groqResponse: GroqResponse = await analyzeCodeWithGroq(input.code, groqOptions);

  // Validar la salida (opcional, pero buena práctica)
  const outputValidation = SuggestCodeImprovementsOutputSchema.safeParse(groqResponse);
  if (!outputValidation.success) {
      console.error("Salida inválida de analyzeCodeWithGroq:", outputValidation.error.format());
      // Considera manejar este caso, por ejemplo, devolviendo un error o una respuesta por defecto.
  }

  return {
    codeSuggestion: groqResponse.codeSuggestion,
    explanation: groqResponse.explanation,
  };
}
