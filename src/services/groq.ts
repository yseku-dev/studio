/**
 * Representa la respuesta de la API del modelo de lenguaje de Groq.
 */
export interface GroqResponse {
  /**
   * La sugerencia de código generada por el modelo Groq.
   */
  codeSuggestion: string;
  /**
   * Una descripción del cambio sugerido.
   */
  explanation: string;
}

/**
 * Opciones de configuración para interactuar con la API de Groq.
 */
export interface GroqOptions {
  /**
   * La clave API para autenticarse con Groq.
   */
  apiKey: string;
  /**
   * El modelo específico de Groq a utilizar para el análisis de código.
   */
  modelName: string;
  /**
   * El tiempo máximo en milisegundos para esperar una respuesta de la API.
   * Por defecto es 60000 (60 segundos).
   */
  timeoutMs?: number;
}

const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 60000; // 60 segundos

/**
 * Helper function to fetch data with retry logic for rate limits and transient errors.
 */
async function fetchWithRetry(
  url: string,
  fetchRequestOptions: RequestInit,
  maxRetries: number = 3,
  initialDelayMs: number = 2000, // Base delay for exponential backoff
  serviceName: string = "Groq API"
): Promise<Response> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const response = await fetch(url, fetchRequestOptions);

      if (response.ok) {
        return response;
      }

      const errorBodyText = await response.text(); // Read body for all error types

      if (response.status === 429) { // Too Many Requests
        lastError = new Error(`Error de la API de Groq (${serviceName}): Límite de tasa excedido (429). Detalle: ${errorBodyText}`);
        
        if (attempt >= maxRetries) {
          console.error(`Máximos reintentos (${maxRetries}) alcanzados para ${serviceName} después de error 429. Último error:`, errorBodyText);
          throw lastError;
        }

        let waitMs = initialDelayMs * Math.pow(2, attempt - 1); // Exponential backoff base

        // Intenta parsear el delay sugerido por la API desde el cuerpo del error
        const retryAfterMatch = errorBodyText.match(/try again in (\d+\.?\d*)\s*s/i);
        if (retryAfterMatch && retryAfterMatch[1]) {
          const suggestedSeconds = parseFloat(retryAfterMatch[1]);
          const suggestedWaitMs = Math.ceil(suggestedSeconds * 1000) + (Math.random() * 1000); // Añadir jitter
          waitMs = Math.max(waitMs, suggestedWaitMs); // Usar el mayor entre el sugerido y el exponencial
          console.warn(`${serviceName} 429: Reintentando después del retraso sugerido/calculado de ${waitMs / 1000}s. Intento ${attempt}/${maxRetries}. Error: ${errorBodyText.substring(0, 200)}`);
        } else {
          console.warn(`${serviceName} 429: Límite de tasa excedido. Reintentando en ${waitMs / 1000}s (intento ${attempt}/${maxRetries}). Error: ${errorBodyText.substring(0,200)}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue; // Siguiente intento
      }

      // Para otros errores HTTP no OK (4xx, 5xx distintos de 429)
      console.error(`Respuesta de error HTTP de ${serviceName} - ${response.status}:`, errorBodyText);
      throw new Error(`Error HTTP de ${serviceName}: ${response.status} ${response.statusText}. Detalle: ${errorBodyText}`);

    } catch (error) { // Captura errores operacionales de fetch (red, AbortError) o errores lanzados arriba
      lastError = error as Error;
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`Error de timeout llamando a ${serviceName} en intento ${attempt}`);
        throw error; // Propagar AbortError, probablemente significa timeout general de la operación
      }
      
      if (attempt >= maxRetries) {
        console.error(`Máximos reintentos (${maxRetries}) alcanzados para ${serviceName}. Último error:`, error);
        throw new Error(`Falló la solicitud a ${serviceName} después de ${maxRetries} intentos. Último error: ${lastError.message}`);
      }
      
      // Para otros errores (ej. red), reintentar con backoff y jitter
      const waitMs = (initialDelayMs * Math.pow(2, attempt - 1)) + (Math.random() * 1000);
      console.warn(`${serviceName}: Error en intento ${attempt}. Reintentando en ${waitMs / 1000}s. Error: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  // Solo se alcanza si todos los reintentos fallan. lastError debería estar seteado.
  throw new Error(`Falló la solicitud a ${serviceName} después de ${maxRetries} intentos. Último error: ${lastError ? lastError.message : "Error desconocido"}`);
}


/**
 * Analiza de forma asíncrona el código utilizando la API del modelo de lenguaje Groq
 * para sugerir mejoras.
 *
 * @param code El código a analizar.
 * @param options Opciones de configuración para la API de Groq.
 * @returns Una promesa que se resuelve en un objeto GroqResponse que contiene la sugerencia de código y la explicación.
 */
export async function analyzeCodeWithGroq(
  code: string,
  options: GroqOptions
): Promise<GroqResponse> {
  console.log(`Realizando llamada a API de Groq (modelo: ${options.modelName}) para análisis de código...`);
  
  const requestBody = {
    model: options.modelName,
    messages: [
      {
        role: "system",
        content: `Eres un asistente experto en análisis de código. Analiza el siguiente fragmento de código y proporciona:
        1. Una sugerencia de código mejorado (campo "codeSuggestion").
        2. Una explicación concisa de las mejoras (campo "explanation").
        Responde ÚNICAMENTE en formato JSON con las claves exactas: "codeSuggestion" y "explanation". Asegúrate de que la respuesta sea un único objeto JSON.`
      },
      {
        role: "user",
        content: `Analiza el siguiente código y sugiere mejoras:\n\n\`\`\`\n${code}\n\`\`\``
      }
    ],
    temperature: 0.3, 
    max_tokens: 2048, 
    response_format: { type: "json_object" },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const fetchRequestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    };

    const response = await fetchWithRetry(GROQ_API_ENDPOINT, fetchRequestOptions, 3, 2000, `analyzeCodeWithGroq(${options.modelName})`);
    // Si fetchWithRetry tuvo éxito, response.ok es true.

    const data = await response.json();
    let parsedResult: GroqResponse;

    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        try {
            parsedResult = JSON.parse(data.choices[0].message.content);
             if (!parsedResult.codeSuggestion || !parsedResult.explanation) {
                console.error("Respuesta JSON de Groq incompleta (analyzeCodeWithGroq):", parsedResult);
                throw new Error("La respuesta JSON de Groq no contiene los campos 'codeSuggestion' o 'explanation'.");
            }
        } catch (parseError) {
            console.error("Error al parsear la respuesta JSON de Groq (analyzeCodeWithGroq):", parseError, "\nContenido recibido:", data.choices[0].message.content);
            throw new Error(`La respuesta de Groq (analyzeCodeWithGroq) no es un JSON válido o faltan campos. Error de parseo: ${(parseError as Error).message}`);
        }
    } else {
        console.error("Respuesta inesperada de la API de Groq (analyzeCodeWithGroq):", data);
        throw new Error("Respuesta inesperada de la API de Groq (analyzeCodeWithGroq).");
    }
    return parsedResult;

  } catch (error) {
    // Este catch ahora maneja errores de fetchWithRetry (AbortError, max retries agotados, errores HTTP no recuperables)
    // y errores de parseo de JSON o validación de la respuesta.
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("Error de timeout final llamando a la API de Groq (analyzeCodeWithGroq)");
      throw new Error("La solicitud a la API de Groq excedió el tiempo límite general.");
    }
    console.error("Error procesando la solicitud a Groq (analyzeCodeWithGroq):", error);
    // Re-lanzar el error para que sea manejado por la capa superior (actions.ts)
    // Los errores de fetchWithRetry ya son bastante descriptivos.
    throw error; 
  } finally {
     clearTimeout(timeoutId); // Asegurar que el timeout se limpie siempre
  }
}


/**
 * Representa la respuesta de la API del modelo de lenguaje de Groq para análisis de proyecto.
 */
export interface ProjectAnalysisGroqResponse {
  analysisTitle: string;
  identifiedAreas: string[];
  suggestions: Array<{ 
    area: string; 
    suggestion: string; 
    priority?: 'high' | 'medium' | 'low';
    suggestedFullFileContent?: string; 
  }>;
  overallAssessment: string;
}

/**
 * Analiza de forma asíncrona el código fuente de un proyecto (o un fragmento de él) utilizando la API del modelo de lenguaje Groq.
 *
 * @param sourceCodeChunk El fragmento de código fuente del proyecto a analizar.
 * @param options Opciones de configuración para la API de Groq.
 * @param analysisPreferences Preferencias o enfoque específico para el análisis de la IA.
 * @returns Una promesa que se resuelve en un objeto ProjectAnalysisGroqResponse.
 */
export async function analyzeProjectSourceWithGroq(
  sourceCodeChunk: string, 
  options: GroqOptions,
  analysisPreferences?: string
): Promise<ProjectAnalysisGroqResponse> {
  console.log(`Realizando llamada a API de Groq (modelo: ${options.modelName}) para análisis de fragmento de proyecto... (${sourceCodeChunk.length} caracteres)`);
  
  let systemPrompt = `Eres un asistente experto en análisis de código. Analiza el siguiente FRAGMENTO de código fuente de un proyecto y proporciona:
1. Un título conciso para el análisis de este fragmento (campo "analysisTitle").
2. Una lista de nombres de archivos o áreas clave identificadas DENTRO DE ESTE FRAGMENTO para revisión o mejora (campo "identifiedAreas").
3. Una lista de sugerencias detalladas (campo "suggestions"). Cada sugerencia debe ser un objeto con:
    - "area": (string) El nombre del archivo o componente al que se aplica la sugerencia (ej. "src/utils/helpers.ts"). Este nombre debe corresponder a un archivo mencionado en el fragmento.
    - "suggestion": (string) Una descripción concisa de la mejora o el problema identificado.
    - "priority": (string, opcional) La prioridad de la sugerencia ('high', 'medium', 'low').
    - "suggestedFullFileContent": (string, opcional) SOLO si la sugerencia implica un cambio de código directo Y el archivo completo está contenido DENTRO de este fragmento, proporciona el contenido COMPLETO del archivo con la sugerencia aplicada. Si el archivo es más grande que este fragmento o la sugerencia no es un cambio de código completo para un archivo totalmente visible aquí, OMITE este campo y detalla los cambios en "suggestion".
4. Una evaluación general del CÓDIGO PROPORCIONADO EN ESTE FRAGMENTO (campo "overallAssessment").

Responde ÚNICAMENTE en formato JSON válido con las claves exactas: "analysisTitle", "identifiedAreas", "suggestions", "overallAssessment". Asegúrate de que la respuesta sea un único objeto JSON. Los nombres de archivo en "area" deben coincidir con los identificadores de archivo "// --- Archivo: nombre_del_archivo ---" presentes en el fragmento.`;

  if (analysisPreferences) {
    systemPrompt += `\n\nTen en cuenta las siguientes preferencias o áreas de enfoque para tu análisis sobre este fragmento: "${analysisPreferences}".`;
  }

  const requestBody = {
    model: options.modelName,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `Analiza el siguiente fragmento de código fuente del proyecto:\n\n${sourceCodeChunk}`
      }
    ],
    temperature: 0.2, 
    max_tokens: 4000, // Ajustado a un límite razonable para la respuesta JSON estructurada
    response_format: { type: "json_object" },
  };

  const controller = new AbortController();
  const timeoutForProjectAnalysis = options.timeoutMs || DEFAULT_TIMEOUT_MS * 2; // Default 120 segundos
  const timeoutId = setTimeout(() => controller.abort(), timeoutForProjectAnalysis);

  try {
    const fetchRequestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    };
    
    const response = await fetchWithRetry(GROQ_API_ENDPOINT, fetchRequestOptions, 5, 3000, `analyzeProjectSourceWithGroq(${options.modelName})`); // Más reintentos para análisis de proyecto

    const data = await response.json();
    let parsedResult: ProjectAnalysisGroqResponse;

    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        try {
            parsedResult = JSON.parse(data.choices[0].message.content);
            if (!parsedResult.analysisTitle || !parsedResult.identifiedAreas || !parsedResult.suggestions || !parsedResult.overallAssessment) {
                console.error("Respuesta JSON de Groq incompleta (análisis de fragmento de proyecto):", parsedResult);
                throw new Error("La respuesta JSON de Groq (análisis de fragmento de proyecto) no contiene todos los campos requeridos.");
            }
        } catch (parseError) {
            console.error("Error al parsear la respuesta JSON de Groq (análisis de fragmento de proyecto):", parseError, "\nContenido recibido:", data.choices[0].message.content);
            throw new Error(`La respuesta de Groq (análisis de fragmento de proyecto) no es un JSON válido o faltan campos. Error de parseo: ${(parseError as Error).message}`);
        }
    } else {
        console.error("Respuesta inesperada de la API de Groq (análisis de fragmento de proyecto):", data);
        throw new Error("Respuesta inesperada de la API de Groq (análisis de fragmento de proyecto).");
    }
    return parsedResult;
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("Error de timeout final llamando a la API de Groq (análisis de fragmento de proyecto)");
      throw new Error("La solicitud de análisis de fragmento de proyecto a la API de Groq excedió el tiempo límite general.");
    }
    console.error("Error procesando la solicitud de análisis de fragmento de proyecto a Groq:", error);
    throw error; // Re-lanzar para manejo en la capa superior
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Prueba la conexión con la API de Groq.
 * @param options Opciones de configuración para la API de Groq.
 * @returns Una promesa que se resuelve en un objeto con el estado de éxito, mensaje y datos opcionales.
 */
export async function testGroqConnection(options: GroqOptions): Promise<{success: boolean; message: string; data?: any}> {
  console.log(`Probando conexión con Groq API (modelo: ${options.modelName})...`);
  const requestBody = {
    model: options.modelName,
    messages: [{ role: "user", content: "Hola. ¿Estás funcionando?" }],
    temperature: 0.1,
    max_tokens: 50,
  };

  const controller = new AbortController();
  const timeoutForTest = options.timeoutMs || 30000; // Default 30 segundos para prueba
  const timeoutId = setTimeout(() => controller.abort(), timeoutForTest);

  try {
    const fetchRequestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    };

    const response = await fetchWithRetry(GROQ_API_ENDPOINT, fetchRequestOptions, 2, 1000, `testGroqConnection(${options.modelName})`); // Menos reintentos para test

    const responseData = await response.json();
    
    // fetchWithRetry ya asegura que response.ok es true si no lanza error.
    if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
        return { success: true, message: "Conexión con Groq API exitosa.", data: responseData.choices[0].message.content };
    }
    // Si la estructura de la respuesta no es la esperada, aunque la llamada HTTP fuera OK.
    console.warn("Respuesta inesperada de Groq API durante la prueba de conexión, aunque la llamada fue exitosa:", responseData);
    return { success: false, message: "Respuesta inesperada de Groq API durante la prueba de conexión.", data: responseData };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("Error de timeout probando la conexión con Groq API");
      return { success: false, message: "La prueba de conexión a la API de Groq excedió el tiempo límite." };
    }
    console.error("Error probando la conexión con Groq API:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, message: `Falló la prueba de conexión: ${errorMessage}` };
  } finally {
    clearTimeout(timeoutId);
  }
}
