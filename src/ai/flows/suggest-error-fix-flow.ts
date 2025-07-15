'use server';
/**
 * @fileOverview Flujo para sugerir soluciones a mensajes de error utilizando la API LLM configurada.
 *
 * - suggestErrorFix - Una función que sugiere soluciones a un error dado.
 * - SuggestErrorFixInput - El tipo de entrada para la función suggestErrorFix.
 * - SuggestErrorFixOutput - El tipo de retorno para la función suggestErrorFix.
 */

import {z} from 'zod';
import { chatWithLLM, type LLMOptions, type ChatMessage, type ChatLLMPayload } from '@/services/groq'; // Use generic chat function
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';

// Schema for LLMOptions, required as part of the input
const LLMOptionsSchema = z.object({
  providerId: z.custom<LLMProviderId>(val => LLM_PROVIDERS.some(p => p.id === val), { message: "Invalid Provider ID" }),
  apiKey: z.string(),
  modelName: z.string(),
  apiUrl: z.string().url().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

const SuggestErrorFixInputSchema = z.object({
  error_message: z.string().describe('El mensaje de error completo que necesita ser analizado y solucionado.'),
  context: z.string().optional().describe('Contexto adicional sobre dónde y cuándo ocurrió el error (ej. función, operación).'),
  llmOptions: LLMOptionsSchema.describe('Opciones de configuración para la API LLM.'),
});
export type SuggestErrorFixInput = z.infer<typeof SuggestErrorFixInputSchema>;

const SuggestErrorFixOutputSchema = z.object({
  root_cause_analysis: z.string().describe('Un análisis de la posible causa raíz del error.'),
  solution_suggestions: z.string().describe('Una o más sugerencias detalladas para solucionar el error, incluyendo posibles cambios de código o configuración. Si hay múltiples pasos, deben estar en este mismo string, separados por saltos de línea.'),
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

  console.log(`[SuggestErrorFix] Llamando a ${providerConfig?.name || llmOptions.providerId} (modelo: ${llmOptions.modelName}): "${error_message.substring(0,100)}..."`);

  const systemPrompt = `Eres un ingeniero de software experto en depuración y resolución de problemas.
Analiza el siguiente mensaje de error y el contexto proporcionado.
Tu objetivo es identificar la causa raíz más probable y ofrecer sugerencias claras y accionables para solucionarlo.

Responde ÚNICAMENTE en formato JSON válido con las siguientes claves:
- "root_cause_analysis": (string) Un análisis detallado de la causa raíz más probable del error.
- "solution_suggestions": (string) Una explicación paso a paso de cómo solucionar el error. Si implica cambios de código, sé específico sobre qué cambiar y por qué. Si implica configuraciones, detalla los pasos. **Si la solución implica múltiples pasos o sugerencias, inclúyelas todas en este ÚNICO string, separadas por saltos de línea (\`\\n\`). NO utilices un array de strings para este campo.**

Considera que el error puede estar relacionado con límites de API, configuración incorrecta, problemas de código, dependencias, timeouts, etc.

**Instrucciones Específicas para Tipos de Error:**

1.  **Errores de Formato JSON (ej. "no contenía un bloque JSON reconocible", "Unexpected token '<'", "not valid JSON"):**
    -   Analiza si el prompt del sistema del agente que falló (Orquestador o el agente específico) instruye CLARAMENTE sobre el formato JSON exacto requerido. Asegúrate de que el prompt especifique que la respuesta DEBE SER *EXCLUSIVAMENTE* el objeto JSON, sin texto introductorio, explicaciones adicionales, o etiquetas como "<think>".
    -   Sugiere revisar y simplificar el prompt del sistema del agente que falló para asegurar que la instrucción de formato JSON sea la más prominente y clara.
    -   Considera si el modelo LLM usado por el agente es adecuado para seguir instrucciones de formato estrictas. Algunos modelos son mejores que otros en esto. Si es un modelo menos potente, sugiere probar con uno más avanzado si es posible.
    -   Propón verificar si hay caracteres extraños o texto no JSON en la respuesta cruda del LLM y cómo el código podría intentar extraer el JSON de forma más robusta.

2.  **Errores de TIMEOUT o Límite de Tiempo Excedido:**
    -   **Causa Raíz**: Considera estas posibilidades: 1) Timeout de red/infraestructura. 2) Timeout de la aplicación es demasiado corto para la tarea. 3) Complejidad del prompt o del historial de conversación. 4) Modelo LLM lento o sobrecargado.
    -   **Sugerencias**: 1) Aumentar los valores de timeout configurados en CodeAlchemist. 2) Simplificar el prompt o la tarea del agente/orquestador. 3) Reducir el tamaño del payload (ej. resumiendo el historial). 4) Probar un modelo LLM más rápido. 5) Verificar la conectividad y el estado del proveedor LLM.

3.  **Errores HTTP (4xx/5xx):**
    -   **Error 400 (Bad Request)**: Generalmente indica un problema con la solicitud enviada. Revisa los parámetros, el cuerpo (payload) y los encabezados. El error puede ser un campo faltante, un tipo de dato incorrecto o un formato inválido (ej. JSON malformado enviado a la API). Sugiere inspeccionar el payload que se está enviando.
    -   **Error 401 (Unauthorized) / 403 (Forbidden)**: Claramente es un problema de autenticación o autorización. Sugiere: 1) Verificar que la Clave API es correcta, válida y no ha expirado. 2) Asegurarse de que la clave API tiene los permisos necesarios para el modelo o la acción solicitada. 3) Comprobar que el encabezado de autorización se está enviando correctamente.
    -   **Error 404 (Not Found)**: Indica que el recurso solicitado no existe. Sugiere: 1) Verificar la URL del endpoint de la API. 2) Comprobar que el nombre del modelo especificado es correcto y está disponible para ese proveedor y clave API.
    -   **Error 429 (Too Many Requests)**: Indica que se ha excedido el límite de tasa de la API. Sugiere: 1) Reducir la frecuencia de las solicitudes. 2) Implementar o verificar la lógica de reintentos con backoff exponencial. 3) Considerar si es posible actualizar el plan de la API para obtener límites más altos.
    -   **Errores 5xx (Server Error)**: Indican un problema en el servidor del proveedor LLM. Sugiere: 1) Que el problema es probablemente temporal y del lado del proveedor. 2) Recomienda esperar un tiempo y reintentar. 3) Aconseja verificar la página de estado del proveedor LLM (ej. status.openai.com) para ver si hay incidentes reportados.

4.  **Errores de Límites de API (ej. TPM, RPM, "Payload Too Large"):**
    - Explica qué significa el límite y cómo el usuario puede ajustar su uso o configuración para respetarlo (ej. reducir tamaño de payload, añadir reintentos con backoff, espaciar las solicitudes, considerar actualizar plan si es una opción).

No incluyas markdown ni texto introductorio/conclusivo fuera del JSON.`;

  let userPromptContent = `Mensaje de Error:\n\`\`\`\n${error_message}\n\`\`\`\n`;
  if (context) {
    userPromptContent += `Contexto del Error:\n${context}\n`;
  }

  const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptContent }
  ];

  try {
    // Use the generic chatWithLLM function from the service layer
    const chatPayload: ChatLLMPayload = {
        messages: messages,
        options: llmOptions // Pass the validated and complete LLMOptions
    };
    
    const chatResponse = await chatWithLLM(chatPayload);

    // Attempt to parse the JSON response from the content string
    let result: SuggestErrorFixOutput;
    try {
        // Attempt to extract JSON even if it's embedded in other text (e.g. ```json ... ```)
        const jsonMatch = chatResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
            result = JSON.parse(jsonMatch[0]);
        } else {
            // If no clear JSON block is found, try parsing the whole content
            // This might fail if there's leading/trailing non-JSON text, which is common
            console.warn("[SuggestErrorFix] No se encontró un bloque JSON claro en la respuesta. Intentando parsear contenido completo:", chatResponse.content.substring(0, 200) + "...");
            try {
                 result = JSON.parse(chatResponse.content);
            } catch (fullParseError) {
                 console.error("Error al parsear la respuesta JSON COMPLETA de LLM (suggestErrorFix):", fullParseError, "\nContenido recibido:", chatResponse.content);
                 throw new Error(`La respuesta de LLM (suggestErrorFix) no es un JSON válido o está malformada (incluso sin bloques JSON explícitos). Error: ${(fullParseError as Error).message}. Respuesta parcial: ${chatResponse.content.substring(0, 200)}...`);
            }
        }
    } catch (parseError) {
        console.error("Error al parsear la respuesta JSON de LLM (suggestErrorFix) tras intento de extracción:", parseError, "\nContenido recibido:", chatResponse.content);
        throw new Error(`La respuesta de LLM (suggestErrorFix) no es un JSON válido o está malformada. Error: ${(parseError as Error).message}. Respuesta parcial: ${chatResponse.content.substring(0, 200)}...`);
    }

    // Validate the structure received from the LLM
    const outputValidation = SuggestErrorFixOutputSchema.safeParse(result);
    if (!outputValidation.success) {
        console.error("Salida inválida de LLM (suggestErrorFix):", outputValidation.error.format(), "\nDatos recibidos:", result);
        const formattedErrors = outputValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        // Check if the error is specifically about solution_suggestions being an array
        const solutionSuggestionError = outputValidation.error.errors.find(
            e => e.path.includes('solution_suggestions') && e.message.toLowerCase().includes('expected string, received array')
        );
        if (solutionSuggestionError && Array.isArray((result as any).solution_suggestions)) {
            // Attempt to fix by joining the array
            console.warn("[SuggestErrorFix] Intentando corregir 'solution_suggestions' de array a string.");
            (result as any).solution_suggestions = ((result as any).solution_suggestions as string[]).join('\n');
            const reValidation = SuggestErrorFixOutputSchema.safeParse(result);
            if (reValidation.success) {
                console.log("[SuggestErrorFix] 'solution_suggestions' corregido exitosamente.");
                return result as SuggestErrorFixOutput;
            } else {
                 console.error("Falló la re-validación después de corregir 'solution_suggestions':", reValidation.error.format());
                 // Fall through to throw the original formatted error
            }
        }
        throw new Error(`Respuesta de LLM inválida para corrección de errores: ${formattedErrors}`);
    }
    return result;
  } catch (error) {
    console.error(`Error al procesar la sugerencia de corrección de error con ${providerConfig?.name || llmOptions.providerId}:`, error);
    // Re-throw the error which should already be an Error instance from makeLLMRequest/fetchWithRetry
    throw error;
  }
}
