// src/app/(app)/settings/actions.ts
'use server';

import { LLM_PROVIDERS, type LLMProviderId, MODELS_BY_PROVIDER } from '@/config/llm-config';
import simpleGit, { type SimpleGit, type SimpleGitOptions } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface LLMTestConnectionResult {
  success: boolean;
  message: string;
  data?: any; 
}

// Unified function to test LLM connection
export async function handleTestLLMConnection(
  providerId: LLMProviderId,
  apiKey: string,
  modelName: string,
  apiUrl?: string 
): Promise<LLMTestConnectionResult> {
  const provider = LLM_PROVIDERS.find(p => p.id === providerId);
  if (!provider) {
    return { success: false, message: "Proveedor LLM no válido." };
  }

  if (provider.requiresApiKey && !apiKey) {
    return { success: false, message: `La Clave API para ${provider.name} es obligatoria.` };
  }
  if (!modelName) {
    return { success: false, message: `El Nombre del Modelo para ${provider.name} es obligatorio.` };
  }

  const effectiveApiUrl = apiUrl || provider.apiUrl;
  let endpoint = effectiveApiUrl;
  let requestBody: any;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (provider.isGroqCompatible || (provider.id === 'ollama' && !provider.isOllamaCompatible && !provider.isGoogleGenerativeAICompatible) ) { 
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/chat/completions`;
    if (provider.requiresApiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    requestBody = {
      model: modelName,
      messages: [{ role: "user", content: "Hola. ¿Estás funcionando?" }],
      temperature: 0.1,
      max_tokens: 50,
    };
  } else if (provider.isAnthropicCompatible) {
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/messages`;
    if (provider.requiresApiKey) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    }
    requestBody = {
      model: modelName,
      messages: [{ role: "user", content: "Hola. ¿Estás funcionando?" }],
      max_tokens: 50,
      temperature: 0.1,
    };
  } else if (provider.isGoogleGenerativeAICompatible) {
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/${modelName}:generateContent?key=${apiKey}`;
    // No Authorization header needed, key is in URL.
    requestBody = {
      contents: [{ parts: [{ text: "Hola. ¿Estás funcionando?" }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 50,
      }
    };
  } else if (provider.isOllamaCompatible && provider.id === 'ollama') {
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/api/chat`;
    // No specific headers needed for Ollama usually
    requestBody = {
        model: modelName,
        messages: [{ role: "user", content: "Hola. ¿Estás funcionando?" }],
        stream: false,
        options: {
            temperature: 0.1,
            num_predict: 50
        }
    };
  } else {
     return { success: false, message: `El proveedor ${provider.name} no tiene un método de prueba de conexión implementado actualmente.`};
  }

  console.log(`Probando conexión con ${provider.name} (modelo: ${modelName}) en endpoint: ${endpoint}...`);
  
  const controller = new AbortController();
  const timeoutForTest = 30000; 
  const timeoutId = setTimeout(() => controller.abort(), timeoutForTest);

  try {
    const fetchRequestOptions: RequestInit = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    };

    const response = await fetch(endpoint, fetchRequestOptions);
    clearTimeout(timeoutId); // Clear timeout if fetch completes
    
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Error de ${provider.name} API (${response.status}):`, errorBody);
        return { success: false, message: `Error de ${provider.name} API (${response.status}): ${errorBody.substring(0,200)}...`};
    }

    const responseData = await response.json();
    
    let content = "";
    if (provider.isGroqCompatible || (provider.id === 'ollama' && !provider.isOllamaCompatible && !provider.isGoogleGenerativeAICompatible)) {
        content = responseData.choices?.[0]?.message?.content;
    } else if (provider.isAnthropicCompatible) {
        content = responseData.content?.[0]?.text;
    } else if (provider.isGoogleGenerativeAICompatible) {
        if (responseData.candidates && responseData.candidates.length > 0 && responseData.candidates[0].content && responseData.candidates[0].content.parts && responseData.candidates[0].content.parts.length > 0) {
            content = responseData.candidates[0].content.parts[0].text;
        } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
            console.warn(`[${provider.name}] Prompt bloqueado durante prueba de conexión:`, responseData.promptFeedback);
            return { success: false, message: `Prompt bloqueado por ${provider.name}: ${responseData.promptFeedback.blockReason}. Revisa el prompt o la configuración de seguridad.`};
        } else {
             console.warn(`Respuesta de prueba de Gemini con formato inesperado o sin contenido.`, responseData);
        }
    } else if (provider.isOllamaCompatible && provider.id === 'ollama') {
        content = responseData.message?.content;
    }
    
    if (content) {
        return { success: true, message: `Conexión con ${provider.name} API exitosa.`, data: content };
    }
    console.warn(`Respuesta inesperada de ${provider.name} API durante la prueba de conexión, aunque la llamada fue exitosa:`, responseData);
    return { success: false, message: `Respuesta inesperada de ${provider.name} API durante la prueba de conexión.`, data: responseData };

  } catch (error) {
    clearTimeout(timeoutId); 
    let detailMessage: string;

    if (error instanceof Error) {
        detailMessage = error.message;
        if (error.name === 'AbortError' || detailMessage.toLowerCase().includes("timeout") || detailMessage.toLowerCase().includes("excedió el tiempo límite")) {
          detailMessage = `La solicitud de prueba de conexión excedió el tiempo límite de ${timeoutForTest / 1000} segundos.`;
        }
    } else if (typeof error === 'string') {
        detailMessage = error;
    } else {
        detailMessage = "Ha ocurrido un error desconocido durante la operación.";
    }
    
    console.error(`Error en la prueba de conexión con ${provider.name}:`, error);
    return { success: false, message: `Falló la prueba de conexión con ${provider.name}: ${detailMessage}` };
  }
}

export interface FetchModelsResult {
  success: boolean;
  models: string[];
  message?: string;
}

export async function handleFetchModels(providerId: LLMProviderId, apiKey: string, apiUrl?: string): Promise<FetchModelsResult> {
  const provider = LLM_PROVIDERS.find(p => p.id === providerId);
  if (!provider) {
    return { success: false, models: [], message: "Proveedor no válido." };
  }

  if (provider.requiresApiKey && !apiKey) {
    return { success: false, models: [], message: `La clave API para ${provider.name} es obligatoria.` };
  }

  const effectiveApiUrl = apiUrl || provider.apiUrl;
  let endpoint = '';
  const headers: HeadersInit = {};
  
  if (provider.isGroqCompatible || (provider.id === 'lmstudio') || (provider.id === 'ollama' && provider.isGroqCompatible)) {
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/models`;
    if (provider.requiresApiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  } else if (provider.id === 'ollama' && provider.isOllamaCompatible) {
     endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/api/tags`; // Ollama's native endpoint
  } else {
    // For providers like Anthropic or Gemini, return the statically defined models as they don't have a public 'list models' endpoint.
    const staticModels = Object.keys(MODELS_BY_PROVIDER[provider.id] || {});
    return { success: true, models: staticModels, message: `Usando lista de modelos predefinida para ${provider.name}.` };
  }

  try {
    const response = await fetch(endpoint, { method: 'GET', headers });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Error de API (${response.status}): ${errorBody}`);
    }
    const data = await response.json();
    let modelIds: string[] = [];

    if (provider.isGroqCompatible || provider.id === 'lmstudio' || (provider.id === 'ollama' && provider.isGroqCompatible)) {
      modelIds = data.data?.map((model: any) => model.id).filter(Boolean) || [];
    } else if (provider.id === 'ollama' && provider.isOllamaCompatible) {
      modelIds = data.models?.map((model: any) => model.name).filter(Boolean) || [];
    }

    if (modelIds.length === 0) {
      return { success: false, models: [], message: "No se encontraron modelos. Verifica tu clave API, la URL del endpoint o si el servidor está en ejecución." };
    }
    
    // Combine with static list to provide more info like TPM, and sort
    const staticModelList = MODELS_BY_PROVIDER[providerId] || {};
    const combinedModels = Array.from(new Set([...modelIds, ...Object.keys(staticModelList)]));

    combinedModels.sort((a,b) => {
        const tpmA = staticModelList[a]?.tpm || 0;
        const tpmB = staticModelList[b]?.tpm || 0;
        if (tpmA !== tpmB) return tpmB - tpmA;
        return a.localeCompare(b);
    });

    return { success: true, models: combinedModels };

  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, models: [], message: `Falló la obtención de modelos: ${message}` };
  }
}

export interface GitTestConnectionConfig {
    repoUrl: string;
    username: string;
    pat: string;
}

export interface GitTestConnectionResult {
    success: boolean;
    message: string;
    details?: string;
}

export async function handleTestGitConnection(config: GitTestConnectionConfig): Promise<GitTestConnectionResult> {
    const { repoUrl, username, pat } = config;
    if (!repoUrl || !username || !pat) {
        return { success: false, message: "La URL del repositorio, el nombre de usuario y el PAT son obligatorios para probar la conexión Git." };
    }

    let tempRepoPath: string | undefined;
    const operationName = `la prueba de conexión Git a ${repoUrl.replace(pat, '********')}`;
    try {
        console.log(`[GitTest] Iniciando ${operationName}`);
        
        tempRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codealchemist-gittest-'));
        console.log(`[GitTest] Directorio temporal creado: ${tempRepoPath}`);

        const gitOptions: Partial<SimpleGitOptions> = {
            baseDir: tempRepoPath,
            binary: 'git',
            maxConcurrentProcesses: 1,
        };
        const git: SimpleGit = simpleGit(gitOptions);

        const authenticatedRepoUrl = repoUrl.replace("https://", `https://${encodeURIComponent(username)}:${encodeURIComponent(pat)}@`);
        
        console.log(`[GitTest] Intentando listar remotos para ${authenticatedRepoUrl.replace(pat, '********')}`);
        const lsRemoteOutput = await git.listRemote(['--heads', authenticatedRepoUrl]);
        
        console.log(`[GitTest] 'git ls-remote' exitoso. Salida (primeras líneas): ${lsRemoteOutput.substring(0, 200)}...`);

        return { 
            success: true, 
            message: `Conexión Git exitosa al repositorio ${repoUrl.split('/').pop()?.replace('.git','') || repoUrl}. Se pudieron listar las referencias remotas.`
        };

    } catch (error: any) {
        console.error(`[GitTest] Error en ${operationName}:`, error);
        let errorMessage = "Error desconocido durante la prueba de conexión Git.";
        let errorDetails = "";

        if (error.message) {
            errorMessage = error.message;
            if (error.message.includes("Authentication failed")) {
                errorMessage = "Falló la autenticación. Verifica tu nombre de usuario y PAT.";
            } else if (error.message.includes("not found")) {
                errorMessage = "Repositorio no encontrado. Verifica la URL del repositorio.";
            } else if (error.message.includes("src refspec") && error.message.includes("does not match any")) {
                 errorMessage = `La rama local por defecto no coincide con ninguna rama remota. Verifica el nombre de la rama principal del repositorio remoto.`;
            } else if (error.message.includes("could not read Username")) {
                  errorMessage = "Falló la autenticación (no se pudo leer el nombre de usuario). Verifica tu PAT y permisos.";
            }
        }
        
        if (error.stderr) {
            errorDetails = error.stderr;
        } else if (error.message) {
            errorDetails = error.message; // Fallback if stderr is not available
        }
        
        return { 
            success: false, 
            message: `Falló ${operationName}: ${errorMessage}`,
            details: errorDetails.substring(0, 500) 
        };
    } finally {
        if (tempRepoPath) {
            console.log(`[GitTest] Limpiando directorio temporal ${tempRepoPath}`);
            try {
                await fs.rm(tempRepoPath, { recursive: true, force: true });
                console.log(`[GitTest] Directorio temporal eliminado: ${tempRepoPath}`);
            } catch (cleanupError: any) {
                console.error(`[GitTest] Error al limpiar el directorio temporal ${tempRepoPath}: ${cleanupError.message}`);
            }
        }
    }
}
