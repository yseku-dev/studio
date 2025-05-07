'use server';
/**
 * @fileOverview Flujo para analizar el código fuente de la propia aplicación CodeAlchemist.
 *
 * - analyzeCodeAlchemistSource - Una función que analiza el código fuente de CodeAlchemist usando la API de Groq.
 * - AnalyzeCodeAlchemistSourceInput - El tipo de entrada para la función analyzeCodeAlchemistSource.
 * - AnalyzeCodeAlchemistSourceOutput - El tipo de retorno para la función analyzeCodeAlchemistSource.
 * - SuggestionUnit - El tipo para una única unidad de sugerencia.
 */

import {z} from 'zod';
import { analyzeProjectSourceWithGroq, GroqOptions, ProjectAnalysisGroqResponse } from '@/services/groq';

const AnalyzeCodeAlchemistSourceInputSchema = z.object({
  sourceCode: z.string().describe('Un fragmento o colección de código fuente de la aplicación CodeAlchemist para ser analizado.'),
  groqApiKey: z.string().describe('La clave API para acceder al modelo Groq.'),
  groqModelName: z.string().describe('El nombre del modelo Groq a utilizar.'),
  analysisPreferences: z.string().optional().describe('Preferencias o enfoque específico para el análisis de la IA, proporcionadas por el usuario.'),
});
export type AnalyzeCodeAlchemistSourceInput = z.infer<typeof AnalyzeCodeAlchemistSourceInputSchema>;

// Definir el esquema para una única sugerencia
const SuggestionUnitSchema = z.object({
  area: z.string().describe('El área/componente/archivo al que se aplica la sugerencia.'),
  suggestion: z.string().describe('Una sugerencia específica para mejora o refactorización.'),
  priority: z.enum(['high', 'medium', 'low']).optional().describe('Prioridad de la sugerencia.'),
  suggestedFullFileContent: z.string().optional().describe('El contenido completo del archivo modificado sugerido para el área especificada, si la sugerencia implica un cambio de código directo en un archivo.'),
});
export type SuggestionUnit = z.infer<typeof SuggestionUnitSchema>;


// La salida del flujo coincidirá con ProjectAnalysisGroqResponse para simplificar
const AnalyzeCodeAlchemistSourceOutputSchema = z.object({
  analysisTitle: z.string().describe('Un título conciso para los hallazgos del análisis.'),
  identifiedAreas: z.array(z.string()).describe('Áreas o archivos específicos identificados para una posible revisión o mejora.'),
  suggestions: z.array(SuggestionUnitSchema).describe('Una lista de sugerencias para mejorar.'),
  overallAssessment: z.string().describe('Una breve evaluación general del código fuente de CodeAlchemist proporcionado.')
});
export type AnalyzeCodeAlchemistSourceOutput = z.infer<typeof AnalyzeCodeAlchemistSourceOutputSchema>;


export async function analyzeCodeAlchemistSource(input: AnalyzeCodeAlchemistSourceInput): Promise<AnalyzeCodeAlchemistSourceOutput> {
  const validationResult = AnalyzeCodeAlchemistSourceInputSchema.safeParse(input);
  if (!validationResult.success) {
    console.error("Entrada inválida para analyzeCodeAlchemistSource:", validationResult.error.format());
    throw new Error("Entrada inválida para el análisis del código fuente de CodeAlchemist.");
  }

  const groqOptions: GroqOptions = {
    apiKey: input.groqApiKey,
    modelName: input.groqModelName,
  };

  // Utilizar el servicio Groq para analizar el código fuente del proyecto
  const analysisResult: ProjectAnalysisGroqResponse = await analyzeProjectSourceWithGroq(
    input.sourceCode, 
    groqOptions,
    input.analysisPreferences // Pasar las preferencias de análisis
  );
  
  const outputValidation = AnalyzeCodeAlchemistSourceOutputSchema.safeParse(analysisResult);
  if (!outputValidation.success) {
      console.error("Salida inválida de analyzeProjectSourceWithGroq:", outputValidation.error.format());
      // Considera manejar este caso, por ejemplo, devolviendo un error o una respuesta por defecto.
      // Podría ser útil devolver el error de validación o un objeto de error estandarizado.
      throw new Error("La respuesta del análisis del proyecto no cumple el esquema esperado.");
  }
  
  return analysisResult;
}
