// src/services/groq.ts

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
  apiKey: string; 
  modelName: string;
  apiUrl?: string; 
  timeoutMs?: number;
}

// Generic response for code suggestion
export interface CodeSuggestionResponse {
  codeSuggestion: string;
  explanation: string;
}

// Define the type for a single suggestion item
export interface SuggestionItem {
  area: string;
  suggestion: string;
  priority?: 'high' | 'medium' | 'low';
  suggestedFullFileContent?: string;
}

// Generic response for project analysis
export interface ProjectAnalysisResponse {
  analysisTitle: string;
  identifiedAreas: string[];
  suggestions: Array<SuggestionItem>; 
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
  name?: string; 
}

export interface ChatLLMPayload {
  messages: ChatMessage[];
  options: LLMOptions;
}

export interface ChatLLMResponse {
  content: string;
}


const DEFAULT_TIMEOUT_MS = 60000; 
const CHAT_COMPLETION_TIMEOUT_MS = 90000; 

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

      let errorBodyText = `[FetchWithRetry] No se pudo leer el cuerpo del error de ${providerName} (${response.status}). La respuesta podría ser demasiado grande o no ser texto.`;
      try {
          // Limit the size of the error body we try to read to prevent OOM errors
          const bodyBuffer = await response.arrayBuffer();
          const maxErrorBodyReadBytes = 1024 * 10; // 10KB
          if (bodyBuffer.byteLength > maxErrorBodyReadBytes) {
              errorBodyText = `[FetchWithRetry] El cuerpo del error de ${providerName} (${response.status}) es demasiado grande (${bodyBuffer.byteLength} bytes). Mostrando solo los primeros ${maxErrorBodyReadBytes} bytes.`;
              const partialBuffer = bodyBuffer.slice(0, maxErrorBodyReadBytes);
              errorBodyText += new TextDecoder().decode(partialBuffer);
          } else {
              errorBodyText = new TextDecoder().decode(bodyBuffer);
          }
      } catch (readError) {
          console.warn(`[FetchWithRetry] Excepción al leer el cuerpo del error de ${providerName} (${response.status}): ${(readError as Error).message}`);
          // errorBodyText remains the default message from initialization
      }


      if (response.status === 429) {
        lastError = new Error(`Error de la API de ${providerName}: Límite de tasa excedido (429). Detalle: ${errorBodyText.substring(0, 500)}`);

        if (attempt >= maxRetries) {
          console.error(`[FetchWithRetry] Máximos reintentos (${maxRetries}) alcanzados para ${providerName} después de error 429. Último error: ${errorBodyText}`);
          throw lastError;
        }

        let waitMs = initialDelayMs * Math.pow(2, attempt - 1);
        // Extract suggested wait time more robustly
        const retryAfterMatch = errorBodyText.match(/Please try again in (\d+\.?\d*)\s*s/i) || errorBodyText.match(/Rate limit reached.*try again in (\d+\.?\d*)\s*s/i);

        if (retryAfterMatch && retryAfterMatch[1]) {
          const suggestedSeconds = parseFloat(retryAfterMatch[1]);
          const suggestedWaitMs = Math.ceil(suggestedSeconds * 1000) + (Math.random() * 1000); // Add jitter
          waitMs = Math.max(waitMs, suggestedWaitMs);
          console.warn(`[FetchWithRetry] ${providerName} 429: Reintentando después del retraso sugerido/calculado de ${waitMs / 1000}s. Intento ${attempt}/${maxRetries}. Error: ${errorBodyText.substring(0, 200)}`);
        } else {
          console.warn(`[FetchWithRetry] ${providerName} 429: Límite de tasa excedido. Reintentando en ${waitMs / 1000}s (intento ${attempt}/${maxRetries}). Error: ${errorBodyText.substring(0,200)}`);
        }

        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      } else if (response.status === 413) {
        lastError = new Error(`Error de la API de ${providerName}: Payload Too Large (413). Detalle: ${errorBodyText.substring(0, 500)}`);
        console.error(`[FetchWithRetry] Error de Payload Too Large (413) en ${providerName}. El payload es demasiado grande para el modelo. Error: ${errorBodyText}`);
        throw lastError;
      } else {
         lastError = new Error(`Error HTTP de ${providerName}: ${response.status} ${response.statusText}. Detalle: ${errorBodyText.substring(0, 500)}`);
         console.error(`[FetchWithRetry] Respuesta de error HTTP ${response.status} de ${providerName}:`, errorBodyText);
         throw lastError;
      }

    } catch (error) {
      lastError = error as Error;
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[FetchWithRetry] Error de timeout llamando a ${providerName} en intento ${attempt}`);
        throw new Error(`La solicitud a ${providerName} excedió el tiempo límite en el intento ${attempt}.`);
      }

      if (attempt >= maxRetries) {
        console.error(`[FetchWithRetry] Máximos reintentos (${maxRetries}) alcanzados para ${providerName}. Último error:`, error);
        throw new Error(`Falló la solicitud a ${providerName} después de ${maxRetries} intentos. Último error: ${lastError.message}`);
      }

      const waitMs = (initialDelayMs * Math.pow(2, attempt - 1)) + (Math.random() * 1000);
      console.warn(`[FetchWithRetry] ${providerName}: Error en intento ${attempt}. Reintentando en ${waitMs / 1000}s. Error: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  throw new Error(`Falló la solicitud a ${providerName} después de ${maxRetries} intentos. Último error: ${lastError ? lastError.message : "Error desconocido"}`);
}

export async function makeLLMRequest<TResponse>(
  options: LLMOptions,
  messages: ChatMessage[],
  expectedResponseFormat: "json_object" | "text",
  temperature: number = 0.3,
  max_tokens: number = 2048,
  serviceNameSuffix: string = "request" 
): Promise<TResponse> {
  const providerConfig = LLM_PROVIDERS.find(p => p.id === options.providerId);
  if (!providerConfig) {
    throw new Error(`[LLM_SERVICE] Proveedor LLM no configurado: ${options.providerId}`);
  }

  const effectiveApiUrl = options.apiUrl || providerConfig.apiUrl;
  let endpoint = effectiveApiUrl;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  let requestBody: any;

  if (providerConfig.isGroqCompatible || (providerConfig.id === 'ollama' && !providerConfig.isOllamaCompatible && !providerConfig.isGoogleGenerativeAICompatible) ) {
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/chat/completions`;
     if (providerConfig.requiresApiKey && options.apiKey) {
        headers['Authorization'] = `Bearer ${options.apiKey}`;
    }
    requestBody = {
      model: options.modelName,
      messages: messages,
      temperature: temperature,
      max_tokens: max_tokens,
      response_format: expectedResponseFormat === "json_object" ? { type: "json_object" } : undefined,
    };
  } else if (providerConfig.isAnthropicCompatible) {
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/messages`;
    if (providerConfig.requiresApiKey && options.apiKey) {
        headers['x-api-key'] = options.apiKey;
        headers['anthropic-version'] = '2023-06-01';
    }
    const systemMessage = messages.find(m => m.role === 'system');
    const userAssistantMessages = messages.filter(m => m.role !== 'system');
    requestBody = {
      model: options.modelName,
      messages: userAssistantMessages,
      system: systemMessage?.content,
      temperature: temperature,
      max_tokens: max_tokens,
    };
  } else if (providerConfig.isGoogleGenerativeAICompatible) {
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/${options.modelName}:generateContent?key=${options.apiKey}`;
    const systemMsg = messages.find(m => m.role === 'system');
    const chatContents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ 
            role: m.role === 'assistant' ? 'model' : m.role, 
            parts: [{ text: m.content }] 
        }));
    
    requestBody = {
        contents: chatContents,
        generationConfig: {
            temperature: temperature,
            maxOutputTokens: max_tokens,
            responseMimeType: expectedResponseFormat === "json_object" && options.modelName.includes("gemini-1.5") ? "application/json" : undefined,
        }
    };
    if (systemMsg) {
        requestBody.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

  } else if (providerConfig.isOllamaCompatible && providerConfig.id === 'ollama') {
     endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/api/chat`; 
    requestBody = {
      model: options.modelName,
      messages: messages,
      stream: false, 
      format: expectedResponseFormat === "json_object" ? "json" : undefined,
      options: { 
        temperature: temperature,
        num_predict: max_tokens, 
      }
    };
  } else {
    throw new Error(`[LLM_SERVICE] Configuración de solicitud no definida para el proveedor ${providerConfig.name}`);
  }

  console.log(`[LLM_SERVICE][${providerConfig.name} - ${serviceNameSuffix}] Llamando a ${endpoint} con modelo ${options.modelName}`);
  
  let stringifiedBody: string;
  try {
    stringifiedBody = JSON.stringify(requestBody);
  } catch (stringifyError) {
    console.error(`[LLM_SERVICE][${providerConfig.name} - ${serviceNameSuffix}] Error al serializar el cuerpo de la solicitud:`, stringifyError);
    throw new Error(`[LLM_SERVICE] Error interno al preparar la solicitud para ${providerConfig.name}: El payload es demasiado grande o tiene una estructura inválida para serializar. ${(stringifyError as Error).message}`);
  }

  const controller = new AbortController();
  const timeoutDuration = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

  try {
    const fetchRequestOptions: RequestInit = {
      method: 'POST',
      headers: headers,
      body: stringifiedBody,
      signal: controller.signal,
    };

    const response = await fetchWithRetry(endpoint, fetchRequestOptions, `${providerConfig.name} (${serviceNameSuffix})`);
    const data = await response.json();

    let contentToParse: string | undefined;
    if (providerConfig.isGroqCompatible || (providerConfig.id === 'ollama' && !providerConfig.isOllamaCompatible && !providerConfig.isGoogleGenerativeAICompatible) ) {
      contentToParse = data.choices?.[0]?.message?.content;
    } else if (providerConfig.isAnthropicCompatible) {
      contentToParse = data.content?.[0]?.text;
    } else if (providerConfig.isGoogleGenerativeAICompatible) {
        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (candidate.finishReason === "SAFETY") {
                console.warn(`[LLM_SERVICE][${providerConfig.name} - ${serviceNameSuffix}] Contenido bloqueado por razones de seguridad:`, candidate.safetyRatings);
                throw new Error(`Contenido bloqueado por ${providerConfig.name} debido a filtros de seguridad. Por favor, revisa o ajusta tu prompt.`);
            }
            contentToParse = candidate.content?.parts?.[0]?.text;
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            console.warn(`[LLM_SERVICE][${providerConfig.name} - ${serviceNameSuffix}] Prompt bloqueado:`, data.promptFeedback);
            throw new Error(`Prompt bloqueado por ${providerConfig.name} debido a: ${data.promptFeedback.blockReason}. Detalles: ${data.promptFeedback.safetyRatings?.map((r:any)=>`${r.category} - ${r.probability}`).join(', ')}`);
        }
    } else if (providerConfig.isOllamaCompatible && providerConfig.id === 'ollama') {
        contentToParse = data.message?.content; 
    }


    if (contentToParse) {
      if (expectedResponseFormat === "json_object") {
        try {
          // Attempt to clean the JSON string: remove potential markdown backticks and ensure it's a single JSON object.
          const cleanedContent = contentToParse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          return JSON.parse(cleanedContent) as TResponse;
        } catch (parseError) {
          console.error(`[LLM_SERVICE] Error al parsear la respuesta JSON de ${providerConfig.name} (${serviceNameSuffix}):`, parseError, "\nContenido recibido:", contentToParse);
          throw new Error(`La respuesta de ${providerConfig.name} (${serviceNameSuffix}) no es un JSON válido o está malformada. Error: ${(parseError as Error).message}`);
        }
      } else {
        return { content: contentToParse } as unknown as TResponse;
      }
    } else {
      console.error(`[LLM_SERVICE] Respuesta inesperada o vacía de la API de ${providerConfig.name} (${serviceNameSuffix}):`, data);
      throw new Error(`Respuesta inesperada de la API de ${providerConfig.name} (${serviceNameSuffix}). No se encontró contenido interpretable.`);
    }
  } catch (error) {
     let errorMessage: string;
     if (error instanceof Error) {
       errorMessage = error.message; 
     } else if (typeof error === 'string') {
       errorMessage = error;
     } else {
       // Attempt to stringify, but be very careful
       let errorDetails = "Complex error object";
       try {
         errorDetails = JSON.stringify(error);
       } catch (stringifyError) {
         errorDetails = "Unserializable complex error object";
       }
       errorMessage = `[LLM_SERVICE] Error desconocido (tipo: ${typeof error}) durante la solicitud a ${providerConfig.name} (${serviceNameSuffix}). Detalles: ${errorDetails.substring(0,200)}`;
     }
     const finalErrorMessage = String(errorMessage || `[LLM_SERVICE] Error desconocido en makeLLMRequest para ${providerConfig.name}`);
     console.error(`[LLM_SERVICE] Error procesando la solicitud a ${providerConfig.name} (${serviceNameSuffix}): ${finalErrorMessage}`, error); // Log the original error too
     throw new Error(finalErrorMessage);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function analyzeCode(
  code: string,
  options: LLMOptions
): Promise<CodeSuggestionResponse> {
  const systemPrompt = `Eres un asistente experto en análisis de código. Analiza el siguiente fragmento de código y proporciona:
1. Una sugerencia de código mejorado (campo "codeSuggestion").
2. Una explicación concisa de las mejoras (campo "explanation").
Responde ÚNICAMENTE en formato JSON válido con las claves exactas: "codeSuggestion" y "explanation". Asegúrate de que la respuesta sea un único objeto JSON válido. No incluyas markdown ni texto introductorio/conclusivo fuera del JSON. Todas las explicaciones y sugerencias deben estar en castellano.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Analiza el siguiente código y sugiere mejoras:\n\n\`\`\`\n${code}\n\`\`\`` }
  ];

  const result = await makeLLMRequest<CodeSuggestionResponse>(
    options,
    messages,
    "json_object",
    0.3, 
    2048, 
    "analyzeCode"
  );

  if (!result.codeSuggestion || typeof result.explanation === 'undefined') { 
    console.error("[LLM_SERVICE] Respuesta JSON de LLM incompleta o malformada (analyzeCode):", result);
    throw new Error("La respuesta JSON del LLM (analyzeCode) no contiene los campos 'codeSuggestion' o 'explanation' esperados.");
  }
  return result;
}


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

Responde ÚNICAMENTE en formato JSON válido con las claves exactas: "analysisTitle", "identifiedAreas", "suggestions", "overallAssessment". Asegúrate de que la respuesta sea un único objeto JSON válido y que "identifiedAreas" y "suggestions" sean arrays. No incluyas markdown ni texto introductorio/conclusivo fuera del JSON. Todas las descripciones, títulos y sugerencias deben estar en castellano.`;

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
      0.2, 
      4000, 
      "analyzeProjectSourceChunk"
  );

   if (
      typeof result.analysisTitle !== 'string' ||
      !Array.isArray(result.identifiedAreas) ||
      !Array.isArray(result.suggestions) ||
      typeof result.overallAssessment !== 'string'
    ) {
      console.error("[LLM_SERVICE] Respuesta JSON de LLM incompleta o con tipos incorrectos (analyzeProjectSourceChunk):", result);
      throw new Error("La respuesta JSON del LLM (analyzeProjectSourceChunk) no tiene la estructura o tipos esperados.");
    }
    for (const sug of result.suggestions) {
        if (typeof sug.area !== 'string' || typeof sug.suggestion !== 'string') {
             console.error("[LLM_SERVICE] Item de sugerencia inválido en analyzeProjectSourceChunk:", sug, "\nRespuesta completa:", result);
             throw new Error("La respuesta JSON del LLM (analyzeProjectSourceChunk) contiene un item de sugerencia inválido.");
        }
    }

  return result;
}

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
No incluyas markdown ni texto introductorio/conclusivo fuera del JSON. Todas las explicaciones y el código generado deben estar en castellano donde sea apropiado (comentarios, nombres de variables si el prompt lo sugiere, etc.).`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemMessage },
    { role: "user", content: prompt }
  ];

  const result = await makeLLMRequest<GeneratedCodeResponse>(
    options,
    messages,
    "json_object",
    0.4, 
    3000, 
    "generateCodeFromPrompt"
  );

  if (typeof result.generatedCode !== 'string') { 
    console.error("[LLM_SERVICE] Respuesta JSON de LLM incompleta o malformada (generateCodeFromPrompt):", result);
    throw new Error("La respuesta JSON del LLM (generateCodeFromPrompt) no contiene el campo 'generatedCode' como string.");
  }
  return result;
}


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
No incluyas markdown ni texto introductorio/conclusivo fuera del JSON. Todas las notas y nombres de archivos/carpetas deben estar en castellano si el prompt original está en castellano o si parece apropiado.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemMessage },
    { role: "user", content: prompt }
  ];

  const result = await makeLLMRequest<GeneratedProjectResponse>(
    options,
    messages,
    "json_object",
    0.3, 
    4000, 
    "generateProjectStructure"
  );

  if (
      !result.projectStructure ||
      typeof result.projectStructure !== 'object' ||
      !Array.isArray(result.projectStructure.files)
     ) {
      console.error("[LLM_SERVICE] Respuesta JSON de LLM incompleta o malformada (generateProjectStructure - structure):", result);
      throw new Error("La respuesta JSON de LLM (generateProjectStructure) no contiene 'projectStructure' o 'projectStructure.files' no es un array.");
  }
  for (const file of result.projectStructure.files) {
      if (typeof file.path !== 'string' || typeof file.content !== 'string') {
          console.error("[LLM_SERVICE] Objeto de archivo inválido en la respuesta de LLM (generateProjectStructure):", file, "\nRespuesta completa:", result);
          throw new Error("La respuesta JSON de LLM (generateProjectStructure) contiene un objeto de archivo inválido (falta 'path' o 'content' como string).");
      }
  }

  return result;
}

export async function chatWithLLM(payload: ChatLLMPayload): Promise<ChatLLMResponse> {
  const { messages, options } = payload;
  const providerConfig = LLM_PROVIDERS.find(p => p.id === options.providerId);
  if (!providerConfig) {
    throw new Error(`[LLM_SERVICE] Proveedor LLM no configurado: ${options.providerId}`);
  }

  const chatOptions = {
    ...options,
    timeoutMs: options.timeoutMs || CHAT_COMPLETION_TIMEOUT_MS,
  };
  
  // Add instruction for Spanish responses if not already a system instruction.
  const systemMessageIndex = messages.findIndex(m => m.role === 'system');
  const spanishInstruction = "Por favor, responde siempre en castellano.";
  if (systemMessageIndex !== -1) {
    if (!messages[systemMessageIndex].content.toLowerCase().includes("castellano") && !messages[systemMessageIndex].content.toLowerCase().includes("español")) {
      messages[systemMessageIndex].content += `\n${spanishInstruction}`;
    }
  } else {
    messages.unshift({ role: "system", content: spanishInstruction });
  }


  const result = await makeLLMRequest<ChatLLMResponse>(
    chatOptions,
    messages,
    "text", 
    0.7, 
    2048, 
    "chatWithLLM"
  );

  if (typeof result.content !== 'string') { 
    console.error(`[LLM_SERVICE] Respuesta de LLM incompleta o inválida (chatWithLLM) para ${providerConfig.name}:`, result);
    throw new Error(`Respuesta de LLM (chatWithLLM) para ${providerConfig.name} no contiene contenido textual.`);
  }
  return result;
}

// Type aliases for better clarity when using these functions
export type GroqOptions = LLMOptions; 
export type GroqResponse = CodeSuggestionResponse; 
export type ProjectAnalysisGroqResponse = ProjectAnalysisResponse; 
export type ChatGroqPayload = ChatLLMPayload; 
export type ChatGroqResponse = ChatLLMResponse;
