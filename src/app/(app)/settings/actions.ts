
'use server';

import { LLM_PROVIDERS, type LLMProviderId, MODELS_BY_PROVIDER } from '@/config/llm-config';
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface LLMTestConnectionResult {
  success: boolean;
  message: string;
  data?: any; // Could be model response or other relevant data
}

// Unified function to test LLM connection
export async function handleTestLLMConnection(
  providerId: LLMProviderId,
  apiKey: string,
  modelName: string,
  apiUrl?: string // Optional for local LLMs
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

  if (provider.isGroqCompatible || provider.id === 'ollama') { // Ollama can use /v1/chat for OpenAI compatibility
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/chat/completions`;
  } else if (provider.isAnthropicCompatible) {
    endpoint = `${effectiveApiUrl.replace(/\/$/, '')}/messages`;
  }
  // Add other provider-specific endpoint logic if necessary

  console.log(`Probando conexión con ${provider.name} (modelo: ${modelName}) en endpoint: ${endpoint}...`);
  
  let requestBody: any;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (provider.requiresApiKey && provider.apiKeyName) {
    if(provider.id === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else { // OpenAI, Groq
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  if (provider.isGroqCompatible || provider.id === 'ollama') {
    requestBody = {
      model: modelName,
      messages: [{ role: "user", content: "Hola. ¿Estás funcionando?" }],
      temperature: 0.1,
      max_tokens: 50,
    };
  } else if (provider.isAnthropicCompatible) {
    requestBody = {
      model: modelName,
      messages: [{ role: "user", content: "Hola. ¿Estás funcionando?" }],
      max_tokens: 50,
      temperature: 0.1,
    };
  } else {
    // Basic ping or specific test for other providers if needed
    // For now, assume we need to send a simple request for others too.
    // This part might need custom logic per provider if they don't fit the above.
     return { success: false, message: `El proveedor ${provider.name} no tiene un método de prueba de conexión implementado actualmente.`};
  }


  const controller = new AbortController();
  const timeoutForTest = 30000; // 30 seconds for test
  const timeoutId = setTimeout(() => controller.abort(), timeoutForTest);

  try {
    const fetchRequestOptions: RequestInit = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    };

    // No retry for test connection, we want immediate feedback.
    const response = await fetch(endpoint, fetchRequestOptions);
    
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Error de ${provider.name} API (${response.status}):`, errorBody);
        return { success: false, message: `Error de ${provider.name} API (${response.status}): ${errorBody.substring(0,200)}...`};
    }

    const responseData = await response.json();
    
    let content = "";
    if (provider.isGroqCompatible || provider.id === 'ollama') {
        content = responseData.choices?.[0]?.message?.content;
    } else if (provider.isAnthropicCompatible) {
        content = responseData.content?.[0]?.text;
    }
    
    if (content) {
        return { success: true, message: `Conexión con ${provider.name} API exitosa.`, data: content };
    }
    console.warn(`Respuesta inesperada de ${provider.name} API durante la prueba de conexión, aunque la llamada fue exitosa:`, responseData);
    return { success: false, message: `Respuesta inesperada de ${provider.name} API durante la prueba de conexión.`, data: responseData };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Error de timeout probando la conexión con ${provider.name} API`);
      return { success: false, message: `La prueba de conexión a la API de ${provider.name} excedió el tiempo límite.` };
    }
    console.error(`Error probando la conexión con ${provider.name} API:`, error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, message: `Falló la prueba de conexión con ${provider.name}: ${errorMessage}` };
  } finally {
    clearTimeout(timeoutId);
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
