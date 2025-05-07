'use server';
/**
 * @fileOverview Flujo para sugerir soluciones a mensajes de error utilizando la API de Groq.
 *
 * - suggestErrorFix - Una función que sugiere soluciones a un error dado.
 * - SuggestErrorFixInput - El tipo de entrada para la función suggestErrorFix.
 * - SuggestErrorFixOutput - El tipo de retorno para la función suggestErrorFix.
 */

import {z} from 'zod';
import type { GroqOptions } from '@/services/groq'; // GroqOptions no necesita ser un esquema aquí, ya que es parte de la configuración del servicio

const GroqOptionsSchema = z.object({
  apiKey: z.string(),
  modelName: z.string(),
  timeoutMs: z.number().optional(),
});

const SuggestErrorFixInputSchema = z.object({
  error_message: z.string().describe('El mensaje de error completo que necesita ser analizado y solucionado.'),
  context: z.string().optional().describe('Contexto adicional sobre dónde y cuándo ocurrió el error (ej. función, operación).'),
  groqOptions: GroqOptionsSchema.describe('Opciones de configuración para la API de Groq.'),
});
export type SuggestErrorFixInput = z.infer<typeof SuggestErrorFixInputSchema>;

const SuggestErrorFixOutputSchema = z.object({
  root_cause_analysis: z.string().describe('Un análisis de la posible causa raíz del error.'),
  solution_suggestions: z.string().describe('Una o más sugerencias detalladas para solucionar el error, incluyendo posibles cambios de código o configuración.'),
  // potential_code_changes: z.array(z.object({
  //   file_path: z.string().optional().describe('Ruta del archivo a modificar (si aplica).'),
  //   original_code_snippet: z.string().optional().describe('Fragmento de código original que causa el error.'),
  //   suggested_code_snippet: z.string().optional().describe('Fragmento de código sugerido para corregir el error.'),
  //   explanation: z.string().describe('Explicación del cambio de código propuesto.'),
  // })).optional().describe('Cambios de código específicos sugeridos, si aplican.')
});
export type SuggestErrorFixOutput = z.infer<typeof SuggestErrorFixOutputSchema>;

// Simulación de llamada a servicio Groq
async function callGroqForErrorFix(
    errorMessage: string, 
    context: string | undefined, 
    options: GroqOptions
): Promise<SuggestErrorFixOutput> {
  console.log(`Llamando a Groq para corregir error (modelo: ${options.modelName}): "${errorMessage.substring(0,100)}..."`);

  const systemPrompt = `Eres un ingeniero de software experto en depuración y resolución de problemas.
Analiza el siguiente mensaje de error y el contexto proporcionado.
Tu objetivo es identificar la causa raíz más probable y ofrecer sugerencias claras y accionables para solucionarlo.

Responde ÚNICAMENTE en formato JSON con las siguientes claves:
- "root_cause_analysis": (string) Un análisis detallado de la causa raíz más probable del error.
- "solution_suggestions": (string) Una explicación paso a paso de cómo solucionar el error. Si implica cambios de código, sé específico sobre qué cambiar y por qué. Si implica configuraciones, detalla los pasos.

Considera que el error puede estar relacionado con límites de API, configuración incorrecta, problemas de código, dependencias, etc.
Si el error menciona límites de API (ej. TPM, RPM, "Payload Too Large", "Rate limit exceeded"), explica qué significa el límite y cómo el usuario puede ajustar su uso o configuración para respetarlo (ej. reducir tamaño de payload, añadir reintentos con backoff, espaciar las solicitudes, considerar actualizar plan si es una opción).`;

  let userPrompt = `Mensaje de Error:\n\`\`\`\n${errorMessage}\n\`\`\`\n`;
  if (context) {
    userPrompt += `Contexto del Error:\n${context}\n`;
  }

  const requestBody = {
    model: options.modelName,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 1500, // Permitir una respuesta detallada
    response_format: { type: "json_object" },
  };

  const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
  const DEFAULT_TIMEOUT_MS = 60000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Respuesta de error de la API de Groq (suggestErrorFix):", errorBody);
      throw new Error(`Error de la API de Groq (suggestErrorFix): ${response.status} ${response.statusText}. Detalle: ${errorBody}`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      try {
        const parsedResult = JSON.parse(data.choices[0].message.content);
        // Validar que los campos esperados estén presentes
        if (!parsedResult.root_cause_analysis || !parsedResult.solution_suggestions) {
             console.error("Respuesta JSON de Groq incompleta (suggestErrorFix):", parsedResult);
             throw new Error("La respuesta JSON de Groq (suggestErrorFix) no contiene los campos 'root_cause_analysis' o 'solution_suggestions'.");
        }
        return parsedResult as SuggestErrorFixOutput;
      } catch (parseError) {
        console.error("Error al parsear la respuesta JSON de Groq (suggestErrorFix):", parseError, "\nContenido recibido:", data.choices[0].message.content);
        throw new Error("La respuesta de Groq (suggestErrorFix) no es un JSON válido o faltan campos.");
      }
    } else {
      throw new Error("Respuesta inesperada de la API de Groq (suggestErrorFix), faltan 'choices' o contenido del mensaje.");
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("Error de timeout llamando a la API de Groq (suggestErrorFix)");
      throw new Error("La solicitud a la API de Groq para sugerir corrección de error excedió el tiempo límite.");
    }
    console.error("Error en callGroqForErrorFix:", error);
    throw error; // Re-lanzar para ser manejado por la función principal
  }
}


export async function suggestErrorFix(input: SuggestErrorFixInput): Promise<SuggestErrorFixOutput> {
  const validationResult = SuggestErrorFixInputSchema.safeParse(input);
  if (!validationResult.success) {
    console.error("Entrada inválida para suggestErrorFix:", validationResult.error.format());
    const formattedErrors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Entrada inválida para sugerencias de corrección de error: ${formattedErrors}`);
  }

  const { error_message, context, groqOptions } = input;

  try {
    const result = await callGroqForErrorFix(error_message, context, groqOptions);
    
    const outputValidation = SuggestErrorFixOutputSchema.safeParse(result);
    if (!outputValidation.success) {
        console.error("Salida inválida de callGroqForErrorFix:", outputValidation.error.format());
        const formattedErrors = outputValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new Error(`Salida inválida del servicio de corrección de errores: ${formattedErrors}`);
    }
    return result;
  } catch (error) {
    console.error("Error al procesar la sugerencia de corrección de error:", error);
    // Aquí, error ya debería ser un Error con un mensaje descriptivo (ya sea de la API o de validación).
    throw error;
  }
}
