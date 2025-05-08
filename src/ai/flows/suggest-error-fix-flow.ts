
'use server';
/**
 * @fileOverview Flujo para sugerir soluciones a mensajes de error utilizando la API LLM configurada.
 *
 * - suggestErrorFix - Una función que sugiere soluciones a un error dado.
 * - SuggestErrorFixInput - El tipo de entrada para la función suggestErrorFix.
 * - SuggestErrorFixOutput - El tipo de retorno para la función suggestErrorFix.
 */

import {z} from 'zod';
import { makeLLMRequest, type LLMOptions, type ChatMessage } from '@/services/groq'; // Use generic service function
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';

// Schema for LLMOptions, required as part of the input
const LLMOptionsSchema = z.object({
  providerId: z.custom<LLMProviderId>(val => typeof val === 'string', { message: "Invalid Provider ID" }),
  apiKey: z.string(),
  modelName: z.string(),
  apiUrl: z.string().url().optional(),
  timeoutMs: z.number().optional(),
});

const SuggestErrorFixInputSchema = z.object({
  error_message: z.string().describe('El mensaje de error completo que necesita ser analizado y solucionado.'),
  context: z.string().optional().describe('Contexto adicional sobre dónde y cuándo ocurrió el error (ej. función, operación).'),
  llmOptions: LLMOptionsSchema.describe('Opciones de configuración para la API LLM.'),
});
export type SuggestErrorFixInput = z.infer<typeof SuggestErrorFixInputSchema>;

const SuggestErrorFixOutputSchema = z.object({
  root_cause_analysis: z.string().describe('Un análisis de la posible causa raíz del error.'),
  solution_suggestions: z.string().describe('Una o más sugerencias detalladas para solucionar el error, incluyendo posibles cambios de código o configuración.'),
});
export type SuggestErrorFixOutput = z.infer<typeof SuggestErrorFixOutputSchema>;

export async function suggestErrorFix(input: SuggestErrorFixInput): Promise<SuggestErrorFixOutput> {
  const validationResult = SuggestErrorFixInputSchema.safeParse(input);
  if (!validationResult.success) {
    console.error("Entrada inválida para suggestErrorFix:", validationResult.error.format());
    const formattedErrors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Entrada inválida para sugerencias de corrección de error: ${formattedErrors}`);
  }

  const { error_message, context, llmOptions } = input;
  const providerConfig = LLM_PROVIDERS.find(p => p.id === llmOptions.providerId);

  console.log(`Llamando a ${providerConfig?.name || llmOptions.providerId} para corregir error (modelo: ${llmOptions.modelName}): "${error_message.substring(0,100)}..."`);

  const systemPrompt = `Eres un ingeniero de software experto en depuración y resolución de problemas.
Analiza el siguiente mensaje de error y el contexto proporcionado.
Tu objetivo es identificar la causa raíz más probable y ofrecer sugerencias claras y accionables para solucionarlo.

Responde ÚNICAMENTE en formato JSON con las siguientes claves:
- "root_cause_analysis": (string) Un análisis detallado de la causa raíz más probable del error.
- "solution_suggestions": (string) Una explicación paso a paso de cómo solucionar el error. Si implica cambios de código, sé específico sobre qué cambiar y por qué. Si implica configuraciones, detalla los pasos.

Considera que el error puede estar relacionado con límites de API, configuración incorrecta, problemas de código, dependencias, etc.
Si el error menciona límites de API (ej. TPM, RPM, "Payload Too Large", "Rate limit exceeded"), explica qué significa el límite y cómo el usuario puede ajustar su uso o configuración para respetarlo (ej. reducir tamaño de payload, añadir reintentos con backoff, espaciar las solicitudes, considerar actualizar plan si es una opción).`;

  let userPromptContent = `Mensaje de Error:\n\`\`\`\n${error_message}\n\`\`\`\n`;
  if (context) {
    userPromptContent += `Contexto del Error:\n${context}\n`;
  }
  
  const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptContent }
  ];

  try {
    // Use the generic makeLLMRequest function
    const result = await makeLLMRequest<SuggestErrorFixOutput>(
        llmOptions,
        messages,
        "json_object",
        0.3, // temperature
        1500, // max_tokens
        "suggestErrorFix"
    );
    
    // Validate the structure received from the LLM
    const outputValidation = SuggestErrorFixOutputSchema.safeParse(result);
    if (!outputValidation.success) {
        console.error("Salida inválida de LLM (suggestErrorFix):", outputValidation.error.format(), "\nDatos recibidos:", result);
        const formattedErrors = outputValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new Error(`Respuesta de LLM inválida para corrección de errores: ${formattedErrors}`);
    }
    return result;
  } catch (error) {
    console.error(`Error al procesar la sugerencia de corrección de error con ${providerConfig?.name || llmOptions.providerId}:`, error);
    // Re-throw the error which should already contain provider context from makeLLMRequest
    throw error;
  }
}
