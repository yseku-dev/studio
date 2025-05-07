// use server'

/**
 * @fileOverview Provides AI-powered suggestions for improving code.
 *
 * - suggestCodeImprovements - A function that suggests code improvements.
 * - SuggestCodeImprovementsInput - The input type for the suggestCodeImprovements function.
 * - SuggestCodeImprovementsOutput - The return type for the suggestCodeImprovements function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {analyzeCodeWithGroq, GroqOptions, GroqResponse} from '@/services/groq';

const SuggestCodeImprovementsInputSchema = z.object({
  code: z.string().describe('The code to analyze for improvements.'),
  groqApiKey: z.string().describe('The API key for accessing the Groq model.'),
  groqModelName: z.string().describe('The name of the Groq model to use.'),
});
export type SuggestCodeImprovementsInput = z.infer<typeof SuggestCodeImprovementsInputSchema>;

const SuggestCodeImprovementsOutputSchema = z.object({
  codeSuggestion: z.string().describe('The suggested improved code.'),
  explanation: z.string().describe('The explanation of the suggested improvement.'),
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

    const groqResponse: GroqResponse = await analyzeCodeWithGroq(input.code, groqOptions);

    return {
      codeSuggestion: groqResponse.codeSuggestion,
      explanation: groqResponse.explanation,
    };
  }
);
