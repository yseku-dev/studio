'use server';
/**
 * @fileOverview Explica un fragmento de código en lenguaje sencillo.
 *
 * - explainCodeSnippet - Una función que explica un fragmento de código.
 * - ExplainCodeSnippetInput - El tipo de entrada para la función explainCodeSnippet.
 * - ExplainCodeSnippetOutput - El tipo de retorno para la función explainCodeSnippet.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainCodeSnippetInputSchema = z.object({
  code: z.string().describe('El fragmento de código a explicar.'),
});
export type ExplainCodeSnippetInput = z.infer<typeof ExplainCodeSnippetInputSchema>;

const ExplainCodeSnippetOutputSchema = z.object({
  explanation: z.string().describe('La explicación del fragmento de código en lenguaje sencillo.'),
});
export type ExplainCodeSnippetOutput = z.infer<typeof ExplainCodeSnippetOutputSchema>;

export async function explainCodeSnippet(input: ExplainCodeSnippetInput): Promise<ExplainCodeSnippetOutput> {
  return explainCodeSnippetFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainCodeSnippetPrompt',
  input: {schema: ExplainCodeSnippetInputSchema},
  output: {schema: ExplainCodeSnippetOutputSchema},
  prompt: `Eres un desarrollador de software experto. Explica el siguiente fragmento de código en lenguaje sencillo, para que una persona no técnica pueda entenderlo.\n\nCódigo:\n{{code}}`,
});

const explainCodeSnippetFlow = ai.defineFlow(
  {
    name: 'explainCodeSnippetFlow',
    inputSchema: ExplainCodeSnippetInputSchema,
    outputSchema: ExplainCodeSnippetOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
