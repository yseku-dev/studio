
'use server';

import type { GroqOptions } from '@/services/groq';
import { generateProjectStructureFromPrompt as callGroqToGenerateProject } from '@/services/groq'; // Renamed import

export interface ProjectFile {
  path: string;
  content: string;
}
export interface GeneratedProjectData {
  projectStructure: {
    projectName?: string;
    files: ProjectFile[];
  };
  notes?: string;
}

export interface GeneratedProjectResponse {
  success: boolean;
  data?: GeneratedProjectData;
  error?: string;
}

const GROQ_API_TIMEOUT_MS_GENERATE_PROJECT = 180000; // 180 segundos para generación de proyecto

export async function handleGenerateProject(
  prompt: string,
  apiKey: string,
  modelName: string
): Promise<GeneratedProjectResponse> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }

  const groqOptions: GroqOptions = {
    apiKey,
    modelName,
    timeoutMs: GROQ_API_TIMEOUT_MS_GENERATE_PROJECT,
  };
  
  try {
    const result = await callGroqToGenerateProject(prompt, groqOptions);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error generando proyecto:", error);
    let errorMessage = "Ocurrió un error desconocido durante la generación del proyecto.";
    if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.toLowerCase().includes("timeout") || error.message.toLowerCase().includes("excedió el tiempo límite")) {
          errorMessage = `La generación del proyecto excedió el tiempo límite de ${GROQ_API_TIMEOUT_MS_GENERATE_PROJECT / 1000} segundos. Intenta con un prompt más simple o revisa la conexión.`;
        }
    }
    return { success: false, error: `Falló la generación del proyecto: ${errorMessage}` };
  }
}
