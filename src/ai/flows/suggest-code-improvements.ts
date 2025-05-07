'use server';

/**
 * @fileOverview Proporciona sugerencias impulsadas por IA para mejorar el código.
 *
 * - suggestCodeImprovements - Una función que sugiere mejoras de código.
 * - SuggestCodeImprovementsInput - El tipo de entrada para la función suggestCodeImprovements.
 * - SuggestCodeImprovementsOutput - El tipo de retorno para la función suggestCodeImprovements.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
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

export async function suggestCodeImprovements(input: SuggestCodeImprovementsInput): Promise<SuggestCodeImprovementsOutput> {
  return suggestCodeImprovementsFlow(input);
}

const suggestCodeImprovementsFlow = ai.defineFlow(
  {
    name: 'suggestCodeImprovementsFlow',
    inputSchema: SuggestCodeImprovementsInputSchema,
    outputSchema: SuggestCodeImprovementsOutputSchema,
  },
  async input => {
    const groqOptions: GroqOptions = {
      apiKey: input.groqApiKey,
      modelName: input.groqModelName,
    };

    // Aquí es donde se llamaría al servicio Groq real.
    // Por ahora, utiliza la implementación simulada en src/services/groq.ts
    const groqResponse: GroqResponse = await analyzeCodeWithGroq(input.code, groqOptions);

    return {
      codeSuggestion: groqResponse.codeSuggestion,
      explanation: groqResponse.explanation,
    };
  }
);
