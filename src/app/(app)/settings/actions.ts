
'use server';

import { testGroqConnection, GroqOptions } from '@/services/groq';
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';


interface TestConnectionResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function handleTestGroqConnection(
  apiKey: string,
  modelName: string
): Promise<TestConnectionResult> {
  if (!apiKey || !modelName) {
    return { success: false, message: "La Clave API de Groq y el Nombre del Modelo son obligatorios." };
  }

  const options: GroqOptions = {
    apiKey,
    modelName,
  };

  try {
    const result = await testGroqConnection(options);
    // testGroqConnection already returns a serializable structure
    return result; 
  } catch (error) {
    // This catch block might be redundant if testGroqConnection itself handles all its errors and returns a TestConnectionResult.
    // However, it's here as a safeguard for unexpected errors thrown by testGroqConnection that aren't caught internally.
    console.error("Error en handleTestGroqConnection (capa de acción):", error); // Log the raw error

    let errorMessage: string;
    if (error instanceof Error) {
        errorMessage = error.message;
    } else {
        try {
            errorMessage = String(error);
        } catch (e) {
            errorMessage = "Ocurrió un error desconocido durante la prueba de conexión.";
        }
    }
    if (!errorMessage && errorMessage !== '') {
        errorMessage = "Ocurrió un error desconocido durante la prueba de conexión.";
    } else if (errorMessage === '') {
        errorMessage = "Error sin mensaje detallado.";
    }
    return { success: false, message: `Falló la prueba de conexión (capa de acción): ${errorMessage}` };
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
        // Attempt to list remote refs as a basic connectivity and authentication test.
        // This command doesn't require a local repository to be fully initialized or cloned.
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
        
        // Attempt to get more details from stderr if available (simple-git often includes it)
        if (error.stderr) {
            errorDetails = error.stderr;
        } else if (error.message) {
            errorDetails = error.message;
        }


        console.error(`[GitTest] Error en la prueba de conexión Git: ${errorMessage}`, errorDetails ? `Detalles: ${errorDetails}` : '', error);
        return { 
            success: false, 
            message: `Falló la prueba de conexión Git: ${errorMessage}`,
            details: errorDetails.substring(0, 500) // Limit detail length
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
