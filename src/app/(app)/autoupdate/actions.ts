'use server';

import { analyzeCodeAlchemistSource, AnalyzeCodeAlchemistSourceInput, AnalyzeCodeAlchemistSourceOutput } from '@/ai/flows/analyze-codealchemist-source-flow';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob'; // Usar glob para encontrar archivos

interface AutoUpdateAnalysisResult {
  success: boolean;
  data?: AnalyzeCodeAlchemistSourceOutput;
  error?: string;
}

export async function handleAutoAnalyzeAppSource(
  apiKey: string,
  modelName: string
): Promise<AutoUpdateAnalysisResult> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }

  const sourceBundleResult = await getApplicationSourceBundle(true); // true para concatenar
  if (!sourceBundleResult.success || !sourceBundleResult.concatenatedSource) {
    return { success: false, error: sourceBundleResult.error || "No se pudo obtener el código fuente para analizar." };
  }

  const input: AnalyzeCodeAlchemistSourceInput = {
    sourceCode: sourceBundleResult.concatenatedSource, // Usar el código concatenado
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
  files?: AppSourceFile[];
  concatenatedSource?: string; // Añadido para el análisis
  error?: string;
}

// Lista de patrones a ignorar (estilo .gitignore)
const ignorePatterns = [
  'node_modules/**',
  '.next/**',
  '*.lock',
  '.DS_Store',
  '*.log',
  'build/**',
  'dist/**',
  '.env.local', // Ignorar archivos .env específicos del entorno local
  // Añade más patrones si es necesario
];

export async function getApplicationSourceBundle(concatenate: boolean = false): Promise<AppSourceBundleResult> {
  try {
    const projectRoot = process.cwd();
    const allFiles = await glob('**/*', { 
      cwd: projectRoot, 
      nodir: true, // No incluir directorios
      dot: true, // Incluir archivos que empiezan con punto (ej. .env, .gitignore)
      ignore: ignorePatterns,
      follow: false, // No seguir symlinks para evitar bucles o salir del proyecto
    });

    const filesData: AppSourceFile[] = [];
    let concatenatedContent = "";

    for (const relativeFilePath of allFiles) {
      try {
        const fullPath = path.join(projectRoot, relativeFilePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        filesData.push({ fileName: relativeFilePath, content });
        if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
        }
      } catch (fileReadError) {
        console.warn(`No se pudo leer el archivo ${relativeFilePath} para el paquete fuente:`, fileReadError);
        const errorMessage = `// Error: No se pudo leer el archivo. (${(fileReadError as Error).message})`;
        filesData.push({ fileName: relativeFilePath, content: errorMessage });
         if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${errorMessage}`;
        }
      }
    }

    if (filesData.length === 0) {
        return { success: false, error: "No se pudieron leer archivos fuente para el paquete." };
    }

    return { success: true, files: filesData, concatenatedSource: concatenate ? concatenatedContent : undefined };
  } catch (error) {
    console.error("Error empaquetando el código fuente de la aplicación:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
    return { success: false, error: `Falló la obtención del paquete de código fuente: ${errorMessage}` };
  }
}

// Acción para aplicar un cambio específico.
// Esta es una función de marcador de posición y necesitaría una implementación mucho más robusta.
export async function applySuggestedChange(filePath: string, originalContent: string, suggestedContent: string): Promise<{success: boolean, error?: string, newContent?: string}> {
    console.log(`Intentando aplicar cambio a: ${filePath}`);
    // ¡PELIGRO! Escribir directamente en archivos es arriesgado.
    // En una aplicación real, esto necesitaría:
    // 1. Confirmación del usuario.
    // 2. Validación exhaustiva.
    // 3. Estrategia de backup/rollback.
    // 4. Posiblemente integración con herramientas de diff/patch.
    // Esta es una SIMULACIÓN MUY SIMPLIFICADA y no debe usarse en producción tal cual.

    try {
        const fullPath = path.join(process.cwd(), filePath);
        
        // Leer el contenido actual para verificar si coincide (muy básico)
        const currentContentOnDisk = await fs.readFile(fullPath, 'utf-8');
        
        if (currentContentOnDisk.trim() !== originalContent.trim()) {
             // Esto es una simplificación. Una comparación de diff sería mejor.
            console.warn("El contenido del archivo en disco ha cambiado desde que se generó la sugerencia.");
            // return { success: false, error: "El contenido del archivo ha cambiado. Por favor, vuelve a analizar." };
        }

        // Escribir el nuevo contenido
        // await fs.writeFile(fullPath, suggestedContent, 'utf-8');
        console.log(`SIMULACIÓN: El archivo ${filePath} se habría actualizado con el contenido sugerido.`);
        console.log("--- CONTENIDO ORIGINAL (FRAGMENTO) ---");
        console.log(originalContent.substring(0, 200) + "...");
        console.log("--- CONTENIDO SUGERIDO (FRAGMENTO) ---");
        console.log(suggestedContent.substring(0, 200) + "...");


        return { success: true, newContent: suggestedContent }; // Devuelve el nuevo contenido para actualizar la UI si es necesario
    } catch (error) {
        console.error(`Error al intentar aplicar el cambio al archivo ${filePath}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido al aplicar el cambio.";
        return { success: false, error: errorMessage };
    }
}
