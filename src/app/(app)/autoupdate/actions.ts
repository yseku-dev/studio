'use server';

import { analyzeCodeAlchemistSource, AnalyzeCodeAlchemistSourceInput, AnalyzeCodeAlchemistSourceOutput } from '@/ai/flows/analyze-codealchemist-source-flow';
import fs from 'fs/promises';
import path from 'path';

interface AutoUpdateAnalysisResult {
  success: boolean;
  data?: AnalyzeCodeAlchemistSourceOutput;
  error?: string;
}

export async function handleAutoAnalyzeAppSource(
  sourceCode: string,
  apiKey: string,
  modelName: string
): Promise<AutoUpdateAnalysisResult> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }
  if (!sourceCode) {
    return { success: false, error: "No se proporcionó código fuente para analizar."};
  }

  const input: AnalyzeCodeAlchemistSourceInput = {
    sourceCode,
    groqApiKey: apiKey,
    groqModelName: modelName,
  };

  try {
    const result = await analyzeCodeAlchemistSource(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error analizando el código fuente de CodeAlchemist:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido durante el auto-análisis.";
    return { success: false, error: `Falló el auto-análisis: ${errorMessage}` };
  }
}


export interface AppSourceFile {
  fileName: string;
  content: string;
}
interface AppSourceBundleResult {
  success: boolean;
  data?: AppSourceFile[];
  error?: string;
}

export async function getApplicationSourceBundle(): Promise<AppSourceBundleResult> {
  try {
    // Lista de archivos clave y no sensibles para incluir en el paquete de descarga conceptual.
    // PRECAUCIÓN: No incluir archivos sensibles como .env o claves secretas.
    const filePathsToInclude = [
      'package.json',
      'next.config.ts',
      'tailwind.config.ts',
      'README.md',
      'src/app/layout.tsx',
      'src/app/(app)/dashboard/page.tsx',
      'src/components/layout/app-sidebar.tsx',
      'src/services/groq.ts', // Ejemplo de un archivo de servicio
      'src/ai/genkit.ts' // Ejemplo de configuración de IA
    ];

    const filesData: AppSourceFile[] = [];

    for (const relativeFilePath of filePathsToInclude) {
      try {
        const fullPath = path.join(process.cwd(), relativeFilePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        filesData.push({ fileName: relativeFilePath, content });
      } catch (fileReadError) {
        console.warn(`No se pudo leer el archivo ${relativeFilePath} para el paquete fuente:`, fileReadError);
        // Opcionalmente, incluir un marcador de posición o error para este archivo
        filesData.push({ fileName: relativeFilePath, content: `// Error: No se pudo leer el archivo. (${(fileReadError as Error).message})` });
      }
    }

    if (filesData.length === 0) {
        return { success: false, error: "No se pudieron leer archivos fuente para el paquete." };
    }

    return { success: true, data: filesData };
  } catch (error) {
    console.error("Error empaquetando el código fuente de la aplicación:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
    return { success: false, error: `Falló la obtención del paquete de código fuente: ${errorMessage}` };
  }
}
