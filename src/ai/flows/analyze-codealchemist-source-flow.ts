'use server';
/**
 * @fileOverview Flujo de IA para analizar el código fuente de la propia aplicación CodeAlchemist.
 *
 * - analyzeCodeAlchemistSource - Una función que analiza el código fuente de CodeAlchemist.
 * - AnalyzeCodeAlchemistSourceInput - El tipo de entrada para la función analyzeCodeAlchemistSource.
 * - AnalyzeCodeAlchemistSourceOutput - El tipo de retorno para la función analyzeCodeAlchemistSource.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { analyzeProjectSourceWithGroq, GroqOptions, ProjectAnalysisGroqResponse } from '@/services/groq';

const AnalyzeCodeAlchemistSourceInputSchema = z.object({
  sourceCode: z.string().describe('Un fragmento o colección de código fuente de la aplicación CodeAlchemist para ser analizado.'),
  groqApiKey: z.string().describe('La clave API para acceder al modelo Groq.'),
  groqModelName: z.string().describe('El nombre del modelo Groq a utilizar.'),
});
export type AnalyzeCodeAlchemistSourceInput = z.infer<typeof AnalyzeCodeAlchemistSourceInputSchema>;

// La salida del flujo coincidirá con ProjectAnalysisGroqResponse para simplificar
const AnalyzeCodeAlchemistSourceOutputSchema = z.object({
  analysisTitle: z.string().describe('Un título conciso para los hallazgos del análisis.'),
  identifiedAreas: z.array(z.string()).describe('Áreas o archivos específicos identificados para una posible revisión o mejora.'),
  suggestions: z.array(z.object({
    area: z.string().describe('El área/componente al que se aplica la sugerencia.'),
    suggestion: z.string().describe('Una sugerencia específica para mejora o refactorización.'),
    priority: z.enum(['high', 'medium', 'low']).optional().describe('Prioridad de la sugerencia.'),
  })).describe('Una lista de sugerencias para mejorar.'),
  overallAssessment: z.string().describe('Una breve evaluación general del código fuente de CodeAlchemist proporcionado.')
});
export type AnalyzeCodeAlchemistSourceOutput = z.infer<typeof AnalyzeCodeAlchemistSourceOutputSchema>;

export async function analyzeCodeAlchemistSource(input: AnalyzeCodeAlchemistSourceInput): Promise<AnalyzeCodeAlchemistSourceOutput> {
  return analyzeCodeAlchemistSourceFlow(input);
}

const analyzeCodeAlchemistSourceFlow = ai.defineFlow(
  {
    name: 'analyzeCodeAlchemistSourceFlow',
    inputSchema: AnalyzeCodeAlchemistSourceInputSchema,
    outputSchema: AnalyzeCodeAlchemistSourceOutputSchema,
  },
  async (input) => {
    const groqOptions: GroqOptions = {
      apiKey: input.groqApiKey,
      modelName: input.groqModelName,
    };

    // Utilizar el servicio Groq (simulado por ahora) para analizar el código fuente del proyecto
    const analysisResult: ProjectAnalysisGroqResponse = await analyzeProjectSourceWithGroq(input.sourceCode, groqOptions);

    // El esquema de salida del flujo es idéntico a ProjectAnalysisGroqResponse
    return analysisResult;
  }
);

