
'use server';
/**
 * @fileOverview Flujo para analizar el código fuente de la propia aplicación CodeAlchemist.
 *
 * - analyzeCodeAlchemistSource - Una función que analiza el código fuente de CodeAlchemist usando la API LLM configurada.
 * - AnalyzeCodeAlchemistSourceInput - El tipo de entrada para la función analyzeCodeAlchemistSource.
 * - AnalyzeCodeAlchemistSourceOutput - El tipo de retorno para la función analyzeCodeAlchemistSource.
 * - SuggestionUnit - El tipo para una única unidad de sugerencia.
 */

import {z} from 'zod';
import { analyzeProjectSourceChunk, type LLMOptions, type ProjectAnalysisResponse } from '@/services/groq'; // Use generic service
import type { LLMProviderId } from '@/config/llm-config'; // Import provider ID type

// Schema for LLMOptions, now required within the input
const LLMOptionsSchema = z.object({
  providerId: z.custom<LLMProviderId>(val => typeof val === 'string', { message: "Invalid Provider ID" }), // Validate as string initially
  apiKey: z.string(), // API key might be empty string if not required by provider
  modelName: z.string(),
  apiUrl: z.string().url().optional(), // Optional API URL override
  timeoutMs: z.number().optional(),
});
export type AnalyzeLLMOptions = z.infer<typeof LLMOptionsSchema>;

const AnalyzeCodeAlchemistSourceInputSchema = z.object({
  sourceCode: z.string().describe('Un fragmento o colección de código fuente de la aplicación CodeAlchemist para ser analizado.'),
  llmOptions: LLMOptionsSchema.describe('Opciones de configuración para la API LLM, incluyendo proveedor, clave, modelo, URL opcional y timeout.'),
  analysisPreferences: z.string().optional().describe('Preferencias o enfoque específico para el análisis de la IA, proporcionadas por el usuario.'),
});
export type AnalyzeCodeAlchemistSourceInput = z.infer<typeof AnalyzeCodeAlchemistSourceInputSchema>;

// Define el esquema para una única sugerencia (matches service response)
const SuggestionUnitSchema = z.object({
  area: z.string().describe('El área/componente/archivo al que se aplica la sugerencia.'),
  suggestion: z.string().describe('Una sugerencia específica para mejora o refactorización.'),
  priority: z.enum(['high', 'medium', 'low']).optional().describe('Prioridad de la sugerencia.'),
  suggestedFullFileContent: z.string().optional().describe('El contenido completo del archivo modificado sugerido para el área especificada, si la sugerencia implica un cambio de código directo en un archivo.'),
});
export type SuggestionUnit = z.infer<typeof SuggestionUnitSchema>;


// La salida del flujo coincidirá con ProjectAnalysisResponse para simplificar
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
    const formattedErrors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Entrada inválida para el análisis del código fuente de CodeAlchemist: ${formattedErrors}`);
  }

  // Utilizar el servicio LLM genérico para analizar el código fuente del proyecto
  // input.llmOptions ya es del tipo LLMOptions
  const analysisResult: ProjectAnalysisResponse = await analyzeProjectSourceChunk(
    input.sourceCode, 
    input.llmOptions, // Pasar directamente el objeto de opciones LLM
    input.analysisPreferences 
  );
  
  const outputValidation = AnalyzeCodeAlchemistSourceOutputSchema.safeParse(analysisResult);
  if (!outputValidation.success) {
      console.error("Salida inválida de analyzeProjectSourceChunk:", outputValidation.error.format());
      const formattedErrors = outputValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`La respuesta del análisis del proyecto no cumple el esquema esperado: ${formattedErrors}`);
  }
  
  return analysisResult;
}
