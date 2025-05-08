import {
  LLM_PROVIDERS,
  MODELS_BY_PROVIDER,
  MAX_RETRIES as LLM_MAX_RETRIES,
  RETRY_DELAY_MS as LLM_RETRY_DELAY_MS,
  type LLMProviderId,
  type ModelInfo,
} from '@/config/llm-config';


// Generic LLM Options
export interface LLMOptions {
  providerId: LLMProviderId;
  apiKey: string; // Could be empty for local models
  modelName: string;
  apiUrl?: string; // Optional override for API endpoint
  timeoutMs?: number;
}

// Generic response for code suggestion
export interface CodeSuggestionResponse {
  codeSuggestion: string;
  explanation: string;
}

// Generic response for project analysis
export interface ProjectAnalysisResponse {
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

// Generic response for code generation
export interface GeneratedCodeResponse {
  generatedCode: string;
  explanation?: string;
}

// Generic response for project structure generation
export interface ProjectFile {
  path: string;
  content: string;
}
export interface GeneratedProjectResponse {
  projectStructure: {
    projectName?: string;
    files: ProjectFile[];
  };
  notes?: string;
}

// Generic chat types
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatLLMPayload {
  messages: ChatMessage[];
  options: LLMOptions;
}

export interface ChatLLMResponse {
  content: string;
}


const DEFAULT_TIMEOUT_MS = 60000; // 60 segundos
const CHAT_COMPLETION_TIMEOUT_MS = 90000; // 90 segundos para chat

async function fetchWithRetry(
  url: string,
  fetchRequestOptions: RequestInit,
  providerName: string,
  maxRetries: number = LLM_MAX_RETRIES,
  initialDelayMs: number = LLM_RETRY_DELAY_MS
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

      let errorBodyText = 'No se pudo leer el cuerpo del error.';
      try {
          errorBodyText = await response.text();
      } catch (readError) {
          console.warn(`No se pudo leer el cuerpo del error de ${providerName} (${response.status})`);
      }


      if (response.status === 429) {
        lastError = new Error(`Error de la API de ${providerName}: Límite de tasa excedido (429). Detalle: ${errorBodyText.substring(0, 500)}`);

        if (attempt >= maxRetries) {
          console.error(`Máximos reintentos (${maxRetries}) alcanzados para ${providerName} después de error 429. Último error:`, errorBodyText);
          throw lastError;
        }

        let waitMs = initialDelayMs * Math.pow(2, attempt - 1);
        const retryAfterMatch = errorBodyText.match(/try again in (\d+\.?\d*)\s*s/i);
        if (retryAfterMatch && retryAfterMatch[1]) {
          const suggestedSeconds = parseFloat(retryAfterMatch[1]);
          const suggestedWaitMs = Math.ceil(suggestedSeconds * 1000) + (Math.random() * 1000);
          waitMs = Math.max(waitMs, suggestedWaitMs);
          console.warn(`${providerName} 429: Reintentando después del retraso sugerido/calculado de ${waitMs / 1000}s. Intento ${attempt}/${maxRetries}. Error: ${errorBodyText.substring(0, 200)}`);
        } else {
          console.warn(`${providerName} 429: Límite de tasa excedido. Reintentando en ${waitMs / 1000}s (intento ${attempt}/${maxRetries}). Error: ${errorBodyText.substring(0,200)}`);
        }

        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      } else if (response.status === 413) {
        lastError = new Error(`Error de la API de ${providerName}: Payload Too Large (413). Detalle: ${errorBodyText.substring(0, 500)}`);
        console.error(`Error de Payload Too Large (413) en ${providerName}. El payload es demasiado grande para el modelo. Error: ${errorBodyText}`);
        throw lastError;
      } else {
         lastError = new Error(`Error HTTP de ${providerName}: ${response.status} ${response.statusText}. Detalle: ${errorBodyText.substring(0, 500)}`);
         // Throw immediately for non-retryable HTTP errors other than 429/413
         console.error(`Respuesta de error HTTP ${response.status} de ${providerName}:`, errorBodyText);
         throw lastError;
      }

    } catch (error) {
      lastError = error as Error;
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`Error de timeout llamando a ${providerName} en intento ${attempt}`);
        // Throw immediately, timeout shouldn't be retried by this logic
        throw new Error(`La solicitud a ${providerName} excedió el tiempo límite en el intento ${attempt}.`);
      }

      if (attempt >= maxRetries) {
        console.error(`Máximos reintentos (${maxRetries}) alcanzados para ${providerName}. Último error:`, error);
        throw new Error(`Falló la solicitud a ${providerName} después de ${maxRetries} intentos. Último error: ${lastError.message}`);
      }

      const waitMs = (initialDelayMs * Math.pow(2, attempt - 1)) + (Math.random() * 1000);
      console.warn(`${providerName}: Error en intento ${attempt}. Reintentando en ${waitMs / 1000}s. Error: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  // Should theoretically not be reached if all paths throw or return, but satisfies TypeScript
  throw new Error(`Falló la solicitud a ${providerName} después de ${maxRetries} intentos. Último error: ${lastError ? lastError.message : "Error desconocido"}`);
}

// Helper to construct API request based on provider type
async function makeLLMRequest<TResponse>(
  options: LLMOptions,
  messages: ChatMessage[],
  expectedResponseFormat: "json_object" | "text",
  temperature: number = 0.3,
  max_tokens: number = 2048,
  serviceNameSuffix: string = "request"
): Promise<TResponse> {
  const providerConfig = LLM_PROVIDERS.find(p => p.id === options.providerId);
  if (!providerConfig) {
    throw new Error(`Proveedor LLM no configurado: ${options.providerId}`);
  }

  const effectiveApiUrl = options.apiUrl || providerConfig.apiUrl;
  let endpoint = effectiveApiUrl;

  // Determine endpoint path based on provider compatibility
  if (providerConfig.isGroqCompatible || (providerConfig.id === 'ollama' && !providerConfig.isOllamaCompatible) ) { // Ollama can use /v1/chat
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/chat/completions`;
  } else if (providerConfig.isAnthropicCompatible) {
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/messages`;
  } else if (providerConfig.isOllamaCompatible && providerConfig.id === 'ollama') { // Native Ollama endpoint
     endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/api/chat`; // or /api/generate if needed
  } else {
    throw new Error(`El proveedor ${providerConfig.name} no tiene una configuración de endpoint compatible definida.`);
  }

  console.log(`[${providerConfig.name} - ${serviceNameSuffix}] Llamando a ${endpoint} con modelo ${options.modelName}`);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (providerConfig.requiresApiKey && options.apiKey && providerConfig.apiKeyName) {
     if (providerConfig.isAnthropicCompatible) {
      headers['x-api-key'] = options.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else { // Groq, OpenAI, compatible Ollama/LMStudio
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }
  }

  let requestBody: any;
  if (providerConfig.isGroqCompatible || (providerConfig.id === 'ollama' && !providerConfig.isOllamaCompatible) ) {
    requestBody = {
      model: options.modelName,
      messages: messages,
      temperature: temperature,
      max_tokens: max_tokens,
      response_format: expectedResponseFormat === "json_object" ? { type: "json_object" } : undefined,
      // stream: false, // Ensure streaming is off for standard requests
    };
  } else if (providerConfig.isAnthropicCompatible) {
    // Anthropic needs system message separately if present
    const systemMessage = messages.find(m => m.role === 'system');
    const userAssistantMessages = messages.filter(m => m.role !== 'system');
    requestBody = {
      model: options.modelName,
      messages: userAssistantMessages,
      system: systemMessage?.content,
      temperature: temperature,
      max_tokens: max_tokens,
      // stream: false,
    };
  } else if (providerConfig.isOllamaCompatible && providerConfig.id === 'ollama') {
    requestBody = {
      model: options.modelName,
      messages: messages,
      stream: false, // For non-streaming response
      format: expectedResponseFormat === "json_object" ? "json" : undefined,
      options: { // Ollama specific model parameters can go here
        temperature: temperature,
        num_predict: max_tokens, // Corresponds to max_tokens
      }
    };
  } else {
      throw new Error(`Configuración de cuerpo de solicitud no definida para el proveedor ${providerConfig.name}`);
  }


  const controller = new AbortController();
  const timeoutDuration = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

  try {
    const fetchRequestOptions: RequestInit = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    };

    const response = await fetchWithRetry(endpoint, fetchRequestOptions, `${providerConfig.name} (${serviceNameSuffix})`);
    const data = await response.json();

    let contentToParse: string | undefined;
    if (providerConfig.isGroqCompatible || (providerConfig.id === 'ollama' && !providerConfig.isOllamaCompatible) ) {
      contentToParse = data.choices?.[0]?.message?.content;
    } else if (providerConfig.isAnthropicCompatible) {
      contentToParse = data.content?.[0]?.text;
    } else if (providerConfig.isOllamaCompatible && providerConfig.id === 'ollama') {
        contentToParse = data.message?.content; // Native Ollama response structure for non-streaming chat
    }


    if (contentToParse) {
      if (expectedResponseFormat === "json_object") {
        try {
          // Clean potential markdown code block fences if present
          const cleanedContent = contentToParse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          return JSON.parse(cleanedContent) as TResponse;
        } catch (parseError) {
          console.error(`Error al parsear la respuesta JSON de ${providerConfig.name} (${serviceNameSuffix}):`, parseError, "\nContenido recibido:", contentToParse);
          throw new Error(`La respuesta de ${providerConfig.name} (${serviceNameSuffix}) no es un JSON válido o está malformado. Error: ${(parseError as Error).message}`);
        }
      } else {
        // For text responses, we assume TResponse is { content: string } or similar
        return { content: contentToParse } as unknown as TResponse;
      }
    } else {
      console.error(`Respuesta inesperada o vacía de la API de ${providerConfig.name} (${serviceNameSuffix}):`, data);
      throw new Error(`Respuesta inesperada de la API de ${providerConfig.name} (${serviceNameSuffix}). No se encontró contenido interpretable.`);
    }
  } catch (error) {
     // Ensure errors propagated from fetchWithRetry or thrown here are Error instances with messages
     if (error instanceof Error) {
       console.error(`Error procesando la solicitud a ${providerConfig.name} (${serviceNameSuffix}): ${error.message}`);
       // Re-throw the existing error if it's already an Error instance
       throw error;
     } else {
       // Wrap unknown errors
       console.error(`Error desconocido procesando la solicitud a ${providerConfig.name} (${serviceNameSuffix}):`, error);
       throw new Error(`Error desconocido durante la solicitud a ${providerConfig.name} (${serviceNameSuffix}).`);
     }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Analiza código para sugerir mejoras.
 */
export async function analyzeCode(
  code: string,
  options: LLMOptions
): Promise<CodeSuggestionResponse> {
  const systemPrompt = `Eres un asistente experto en análisis de código. Analiza el siguiente fragmento de código y proporciona:
1. Una sugerencia de código mejorado (campo "codeSuggestion").
2. Una explicación concisa de las mejoras (campo "explanation").
Responde ÚNICAMENTE en formato JSON válido con las claves exactas: "codeSuggestion" y "explanation". Asegúrate de que la respuesta sea un único objeto JSON válido. No incluyas markdown ni texto introductorio/conclusivo fuera del JSON.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Analiza el siguiente código y sugiere mejoras:\n\n\`\`\`\n${code}\n\`\`\`` }
  ];

  const result = await makeLLMRequest<CodeSuggestionResponse>(
    options,
    messages,
    "json_object",
    0.3, // temperature
    2048, // max_tokens
    "analyzeCode"
  );

  if (!result.codeSuggestion || typeof result.explanation === 'undefined') { // Check for explanation existence, even if empty string
    console.error("Respuesta JSON de LLM incompleta o malformada (analyzeCode):", result);
    throw new Error("La respuesta JSON del LLM (analyzeCode) no contiene los campos 'codeSuggestion' o 'explanation' esperados.");
  }
  return result;
}


/**
 * Analiza un fragmento de código fuente de un proyecto.
 */
export async function analyzeProjectSourceChunk(
  sourceCodeChunk: string,
  options: LLMOptions,
  analysisPreferences?: string
): Promise<ProjectAnalysisResponse> {
  let systemPrompt = `Eres un asistente experto en análisis de código. Analiza el siguiente FRAGMENTO de código fuente de un proyecto y proporciona:
1. Un título conciso para el análisis de este fragmento (campo "analysisTitle").
2. Una lista de nombres de archivos o áreas clave identificadas DENTRO DE ESTE FRAGMENTO para revisión o mejora (campo "identifiedAreas", debe ser un array de strings).
3. Una lista de sugerencias detalladas (campo "suggestions", debe ser un array de objetos). Cada sugerencia debe ser un objeto con:
    - "area": (string) El nombre del archivo o componente al que se aplica la sugerencia (ej. "src/utils/helpers.ts"). Este nombre debe corresponder a un identificador de archivo "// --- Archivo: nombre_del_archivo ---" presente en el fragmento. Si no se aplica a un archivo específico, usa "General".
    - "suggestion": (string) Una descripción concisa de la mejora o el problema identificado.
    - "priority": (string, opcional) La prioridad de la sugerencia ('high', 'medium', 'low').
    - "suggestedFullFileContent": (string, opcional) SOLO si la sugerencia implica un cambio de código directo Y el archivo completo está contenido DENTRO de este fragmento, proporciona el contenido COMPLETO del archivo con la sugerencia aplicada. Si el archivo es más grande que este fragmento, la sugerencia no es un cambio de código completo para un archivo totalmente visible aquí, o no aplica a un archivo específico, OMITE este campo y detalla los cambios en "suggestion".
4. Una evaluación general del CÓDIGO PROPORCIONADO EN ESTE FRAGMENTO (campo "overallAssessment").

Responde ÚNICAMENTE en formato JSON válido con las claves exactas: "analysisTitle", "identifiedAreas", "suggestions", "overallAssessment". Asegúrate de que la respuesta sea un único objeto JSON válido y que "identifiedAreas" y "suggestions" sean arrays. No incluyas markdown ni texto introductorio/conclusivo fuera del JSON.`;

  if (analysisPreferences) {
    systemPrompt += `\n\nTen en cuenta las siguientes preferencias o áreas de enfoque para tu análisis sobre este fragmento: "${analysisPreferences}".`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Analiza el siguiente fragmento de código fuente del proyecto:\n\n${sourceCodeChunk}` }
  ];

  const result = await makeLLMRequest<ProjectAnalysisResponse>(
      options,
      messages,
      "json_object",
      0.2, // temperature
      4000, // max_tokens
      "analyzeProjectSourceChunk"
  );

  // Robust validation of the response structure
   if (
      typeof result.analysisTitle !== 'string' ||
      !Array.isArray(result.identifiedAreas) ||
      !Array.isArray(result.suggestions) ||
      typeof result.overallAssessment !== 'string'
    ) {
      console.error("Respuesta JSON de LLM incompleta o con tipos incorrectos (analyzeProjectSourceChunk):", result);
      throw new Error("La respuesta JSON del LLM (analyzeProjectSourceChunk) no tiene la estructura o tipos esperados.");
    }
    // Optional: Validate suggestion items structure
    for (const sug of result.suggestions) {
        if (typeof sug.area !== 'string' || typeof sug.suggestion !== 'string') {
             console.error("Item de sugerencia inválido en analyzeProjectSourceChunk:", sug, "\nRespuesta completa:", result);
             throw new Error("La respuesta JSON del LLM (analyzeProjectSourceChunk) contiene un item de sugerencia inválido.");
        }
    }

  return result;
}

/**
 * Genera código a partir de un prompt.
 */
export async function generateCodeFromPrompt(
  prompt: string,
  options: LLMOptions
): Promise<GeneratedCodeResponse> {
  const systemMessage = `Eres un asistente de programación experto. Genera un fragmento de código basado en la descripción del usuario.
Proporciona:
1. El código generado (campo "generatedCode").
2. Una breve explicación del código, si es relevante (campo "explanation", opcional).
Responde ÚNICAMENTE en formato JSON válido con la clave "generatedCode" y, opcionalmente, "explanation".
Asegúrate de que el código sea funcional y siga las mejores prácticas.
Si el prompt pide un lenguaje específico, úsalo. Si no, Python es una buena opción por defecto.
No incluyas markdown ni texto introductorio/conclusivo fuera del JSON.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemMessage },
    { role: "user", content: prompt }
  ];

  const result = await makeLLMRequest<GeneratedCodeResponse>(
    options,
    messages,
    "json_object",
    0.4, // temperature
    3000, // max_tokens
    "generateCodeFromPrompt"
  );

  if (typeof result.generatedCode !== 'string') { // Check type as well
    console.error("Respuesta JSON de LLM incompleta o malformada (generateCodeFromPrompt):", result);
    throw new Error("La respuesta JSON del LLM (generateCodeFromPrompt) no contiene el campo 'generatedCode' como string.");
  }
  return result;
}


/**
 * Genera una estructura de proyecto a partir de un prompt.
 */
export async function generateProjectStructureFromPrompt(
  prompt: string,
  options: LLMOptions
): Promise<GeneratedProjectResponse> {
  const systemMessage = `Eres un arquitecto de software y asistente de programación experto.
Basado en la descripción del usuario, genera una estructura de archivos y carpetas para un nuevo proyecto de software.
Proporciona:
1.  Un objeto "projectStructure" que contenga:
    -   "projectName": (string, opcional) Un nombre corto y descriptivo para el directorio raíz del proyecto (ej: "mi-api-express").
    -   "files": (array de objetos) Cada objeto representa un archivo y debe tener:
        -   "path": (string) La ruta completa del archivo desde la raíz del proyecto (ej: "src/index.ts", "public/style.css", "package.json"). Usa barras inclinadas '/' como separadores de directorio.
        -   "content": (string) El contenido inicial para ese archivo. Puede ser código de ejemplo, configuración básica, o un placeholder si el contenido es muy extenso o complejo. Para archivos como README.md, incluye contenido útil.
2.  "notes": (string, opcional) Notas adicionales, como los próximos pasos sugeridos, tecnologías clave usadas, o cómo ejecutar el proyecto si es simple.

Responde ÚNICAMENTE en formato JSON válido con las claves "projectStructure" y, opcionalmente, "notes".
Asegúrate de que "projectStructure.files" sea un array válido de objetos, cada uno con "path" y "content" como strings.
Genera una estructura de directorios lógica y común para el tipo de proyecto descrito.
Incluye archivos de configuración comunes si son relevantes (ej: package.json, tsconfig.json, .gitignore).
El contenido de los archivos debe ser coherente con sus extensiones y propósitos.
No incluyas markdown ni texto introductorio/conclusivo fuera del JSON.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemMessage },
    { role: "user", content: prompt }
  ];

  const result = await makeLLMRequest<GeneratedProjectResponse>(
    options,
    messages,
    "json_object",
    0.3, // temperature
    4000, // max_tokens
    "generateProjectStructure"
  );

  // Robust validation
  if (
      !result.projectStructure ||
      typeof result.projectStructure !== 'object' ||
      !Array.isArray(result.projectStructure.files)
     ) {
      console.error("Respuesta JSON de LLM incompleta o malformada (generateProjectStructure - structure):", result);
      throw new Error("La respuesta JSON de LLM (generateProjectStructure) no contiene 'projectStructure' o 'projectStructure.files' no es un array.");
  }
  for (const file of result.projectStructure.files) {
      if (typeof file.path !== 'string' || typeof file.content !== 'string') {
          console.error("Objeto de archivo inválido en la respuesta de LLM (generateProjectStructure):", file, "\nRespuesta completa:", result);
          throw new Error("La respuesta JSON de LLM (generateProjectStructure) contiene un objeto de archivo inválido (falta 'path' o 'content' como string).");
      }
  }

  return result;
}

/**
 * Envía una solicitud de completado de chat a la API LLM configurada.
 */
export async function chatWithLLM(payload: ChatLLMPayload): Promise<ChatLLMResponse> {
  const { messages, options } = payload;
  const providerConfig = LLM_PROVIDERS.find(p => p.id === options.providerId);
  if (!providerConfig) {
    throw new Error(`Proveedor LLM no configurado: ${options.providerId}`);
  }

  // Define a default timeout specific to chat if not provided in options
  const chatOptions = {
    ...options,
    timeoutMs: options.timeoutMs || CHAT_COMPLETION_TIMEOUT_MS,
  };

  const result = await makeLLMRequest<ChatLLMResponse>(
    chatOptions,
    messages,
    "text", // Chat typically expects text response
    0.7, // temperature, can be higher for chat
    2048, // max_tokens
    "chatWithLLM"
  );

  if (typeof result.content !== 'string') { // Check type as well
    console.error(`Respuesta de LLM incompleta o inválida (chatWithLLM) para ${providerConfig.name}:`, result);
    throw new Error(`Respuesta de LLM (chatWithLLM) para ${providerConfig.name} no contiene contenido textual.`);
  }
  return result;
}

// Renaming old Groq-specific types for clarity if they are still used elsewhere temporarily
export type GroqOptions = LLMOptions; // Deprecated: use LLMOptions
export type GroqResponse = CodeSuggestionResponse; // Deprecated: use CodeSuggestionResponse
export type ProjectAnalysisGroqResponse = ProjectAnalysisResponse; // Deprecated: use ProjectAnalysisResponse
export type ChatGroqPayload = ChatLLMPayload; // Deprecated: use ChatLLMPayload
export type ChatGroqResponse = ChatLLMResponse; // Deprecated: use ChatLLMResponse
