'use server';

/**
 * @fileOverview Proporciona sugerencias para mejorar el código utilizando la API de Groq.
 *
 * - suggestCodeImprovements - Una función que sugiere mejoras de código.
 * - SuggestCodeImprovementsInput - El tipo de entrada para la función suggestCodeImprovements.
 * - SuggestCodeImprovementsOutput - El tipo de retorno para la función suggestCodeImprovements.
 */

import {z} from 'zod'; 
import {analyzeCodeWithGroq, GroqOptions, GroqResponse} from '@/services/groq';

// Definir el esquema para GroqOptions para usarlo en el input
const GroqOptionsSchema = z.object({
  apiKey: z.string(),
  modelName: z.string(),
  timeoutMs: z.number().optional(),
});

const SuggestCodeImprovementsInputSchema = z.object({
  code: z.string().describe('El código a analizar para mejoras.'),
  groqOptions: GroqOptionsSchema.describe('Opciones de configuración para la API de Groq.'),
});
export type SuggestCodeImprovementsInput = z.infer<typeof SuggestCodeImprovementsInputSchema>;

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
  
  // input.groqOptions ya es del tipo GroqOptions
  const groqResponse: GroqResponse = await analyzeCodeWithGroq(input.code, input.groqOptions);

  const outputValidation = SuggestCodeImprovementsOutputSchema.safeParse(groqResponse);
  if (!outputValidation.success) {
      console.error("Salida inválida de analyzeCodeWithGroq:", outputValidation.error.format());
      const formattedErrors = outputValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`Salida inválida del servicio de análisis de código: ${formattedErrors}`);
  }

  return {
    codeSuggestion: groqResponse.codeSuggestion,
    explanation: groqResponse.explanation,
  };
}
