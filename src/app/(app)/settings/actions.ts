
'use server';

import { LLM_PROVIDERS, type LLMProviderId, MODELS_BY_PROVIDER } from '@/config/llm-config';
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
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
    clearTimeout(timeoutId); // Clear timeout on error as well
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Error de timeout probando la conexión con ${provider.name} API`);
      return { success: false, message: `La prueba de conexión a la API de ${provider.name} excedió el tiempo límite.` };
    }
    console.error(`Error probando la conexión con ${provider.name} API:`, error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, message: `Falló la prueba de conexión con ${provider.name}: ${errorMessage}` };
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
    try {
        console.log(`[GitTest] Iniciando prueba de conexión a: ${repoUrl.replace(pat, '********')}`);
        
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
        let errorMessage = "Error desconocido durante la prueba de conexión Git.";
        let errorDetails = "";

        if (error.message) {
            errorMessage = error.message;
            if (error.message.includes("Authentication failed")) {
                errorMessage = "Falló la autenticación. Verifica tu nombre de usuario y PAT.";
            } else if (error.message.includes("not found")) {
                errorMessage = "Repositorio no encontrado. Verifica la URL del repositorio.";
            } else if (error.message.includes("could not read Username")) {
                 errorMessage = "Falló la autenticación (no se pudo leer el nombre de usuario). Verifica tu PAT y permisos.";
            }
        }
        
        if (error.stderr) {
            errorDetails = error.stderr;
        } else if (error.message) {
            errorDetails = error.message;
        }

        console.error(`[GitTest] Error en la prueba de conexión Git: ${errorMessage}`, errorDetails ? `Detalles: ${errorDetails}` : '', error);
        return { 
            success: false, 
            message: `Falló la prueba de conexión Git: ${errorMessage}`,
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
