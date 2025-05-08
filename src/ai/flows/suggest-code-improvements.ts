
'use server';

/**
 * @fileOverview Proporciona sugerencias para mejorar el código utilizando la API LLM configurada.
 *
 * - suggestCodeImprovements - Una función que sugiere mejoras de código.
 * - SuggestCodeImprovementsInput - El tipo de entrada para la función suggestCodeImprovements.
 * - SuggestCodeImprovementsOutput - El tipo de retorno para la función suggestCodeImprovements.
 */

import {z} from 'zod'; 
import { analyzeCode, type LLMOptions, type CodeSuggestionResponse } from '@/services/groq'; // Use generic service and types
import type { LLMProviderId } from '@/config/llm-config'; // Import provider ID type

// Definir el esquema para LLMOptions para usarlo en el input
const LLMOptionsSchema = z.object({
  providerId: z.custom<LLMProviderId>(val => typeof val === 'string', { message: "Invalid Provider ID" }),
  apiKey: z.string(), // API key might be empty string if not required by provider
  modelName: z.string(),
  apiUrl: z.string().url().optional(),
  timeoutMs: z.number().optional(),
});

const SuggestCodeImprovementsInputSchema = z.object({
  code: z.string().describe('El código a analizar para mejoras.'),
  llmOptions: LLMOptionsSchema.describe('Opciones de configuración para la API LLM.'),
});
export type SuggestCodeImprovementsInput = z.infer<typeof SuggestCodeImprovementsInputSchema>;

// Output schema matches the generic CodeSuggestionResponse from the service
const SuggestCodeImprovementsOutputSchema = z.object({
  codeSuggestion: z.string().describe('El código mejorado sugerido.'),
  explanation: z.string().describe('La explicación de la mejora sugerida.'),
});
export type SuggestCodeImprovementsOutput = z.infer<typeof SuggestCodeImprovementsOutputSchema>;

export async function suggestCodeImprovements(input: SuggestCodeImprovementsInput): Promise<SuggestCodeImprovementsOutput> {
  const validationResult = SuggestCodeImprovementsInputSchema.safeParse(input);
  if (!validationResult.success) {
    console.error("Entrada inválida para suggestCodeImprovements:", validationResult.error.format());
    const formattedErrors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Entrada inválida para sugerencias de código: ${formattedErrors}`);
  }
  
  // input.llmOptions ya es del tipo LLMOptions
  const llmResponse: CodeSuggestionResponse = await analyzeCode(input.code, input.llmOptions);

  // Validate the response against the expected schema (which should match CodeSuggestionResponse)
  const outputValidation = SuggestCodeImprovementsOutputSchema.safeParse(llmResponse);
  if (!outputValidation.success) {
      console.error("Salida inválida de analyzeCode:", outputValidation.error.format());
      const formattedErrors = outputValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`Salida inválida del servicio de análisis de código: ${formattedErrors}`);
  }

  // Return the data conforming to the output schema (which is essentially CodeSuggestionResponse)
  return {
    codeSuggestion: llmResponse.codeSuggestion,
    explanation: llmResponse.explanation,
  };
}
