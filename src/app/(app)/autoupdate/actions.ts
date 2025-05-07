'use server';

import { analyzeCodeAlchemistSource, AnalyzeCodeAlchemistSourceInput, AnalyzeCodeAlchemistSourceOutput } from '@/ai/flows/analyze-codealchemist-source-flow';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob'; 

interface AutoUpdateAnalysisResult {
  success: boolean;
  data?: AnalyzeCodeAlchemistSourceOutput;
  error?: string;
}

export async function handleAutoAnalyzeAppSource(
  apiKey: string,
  modelName: string,
  analysisPreferences?: string // Añadido
): Promise<AutoUpdateAnalysisResult> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }

  const sourceBundleResult = await getApplicationSourceBundle(true); 
  if (!sourceBundleResult.success || !sourceBundleResult.concatenatedSource) {
    return { success: false, error: sourceBundleResult.error || "No se pudo obtener el código fuente para analizar." };
  }

  const input: AnalyzeCodeAlchemistSourceInput = {
    sourceCode: sourceBundleResult.concatenatedSource, 
    groqApiKey: apiKey,
    groqModelName: modelName,
    analysisPreferences, // Añadido
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
  concatenatedSource?: string; 
  error?: string;
}

const ignorePatterns = [
  'node_modules/**',
  '.next/**',
  '*.lock',
  '*.zip', // Ignorar archivos zip
  '.DS_Store',
  '*.log',
  'build/**',
  'dist/**',
  '.env.local', 
  // Añade más patrones si es necesario
];

export async function getApplicationSourceBundle(concatenate: boolean = false): Promise<AppSourceBundleResult> {
  try {
    const projectRoot = process.cwd();
    const allFiles = await glob('**/*', { 
      cwd: projectRoot, 
      nodir: true, 
      dot: true, 
      ignore: ignorePatterns,
      follow: false, 
    });

    const filesData: AppSourceFile[] = [];
    let concatenatedContent = "";

    for (const relativeFilePath of allFiles) {
      try {
        // Ignorar archivos muy grandes para la concatenación, para no exceder los límites de tokens del LLM fácilmente
        const stats = await fs.stat(path.join(projectRoot, relativeFilePath));
        if (concatenate && stats.size > 500 * 1024) { // Omitir archivos > 500KB para la concatenación
            console.warn(`Archivo omitido de la concatenación por tamaño: ${relativeFilePath} (${(stats.size / 1024).toFixed(2)} KB)`);
            const message = `// Archivo ${relativeFilePath} omitido de la concatenación por ser demasiado grande (${(stats.size / 1024).toFixed(2)} KB).\n`;
            concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${message}`;
            // Para la descarga (no concatenada), sí lo incluimos si es legible
            if (!concatenate) {
                const content = await fs.readFile(path.join(projectRoot, relativeFilePath), 'utf-8');
                filesData.push({ fileName: relativeFilePath, content });
            } else {
                 // Para la lista de archivos 'files' cuando se concatena, podemos añadir una entrada con el mensaje
                 filesData.push({ fileName: relativeFilePath, content: message });
            }
            continue;
        }


        const fullPath = path.join(projectRoot, relativeFilePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        filesData.push({ fileName: relativeFilePath, content });
        if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
        }
      } catch (fileReadError) {
        // No registrar errores de lectura de binarios como advertencias ruidosas si es un error EACCES o similar en un archivo que no es de texto.
        // Mejorar el filtrado de tipos de archivo si es necesario.
        const error = fileReadError as NodeJS.ErrnoException;
        if (error.code !== 'EACCES' && error.code !== 'EISDIR' && !relativeFilePath.endsWith('.png') && !relativeFilePath.endsWith('.jpg') && !relativeFilePath.endsWith('.ico')) {
            console.warn(`No se pudo leer el archivo ${relativeFilePath} para el paquete fuente:`, fileReadError);
        }
        const errorMessage = `// Error: No se pudo leer el archivo. (${(fileReadError as Error).message})`;
        filesData.push({ fileName: relativeFilePath, content: errorMessage }); // Incluir en la lista de archivos con error
         if (concatenate) { // Incluir marcador en el contenido concatenado
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


export async function applySuggestedChange(filePath: string, originalContent: string, suggestedContent: string): Promise<{success: boolean, error?: string, newContent?: string}> {
    console.log(`SIMULACIÓN: Intentando aplicar cambio a: ${filePath}`);
    
    // Por seguridad, la escritura real a archivos está DESACTIVADA.
    // Esta función ahora solo simula y registra.
    const isSimulation = true; 

    try {
        const fullPath = path.join(process.cwd(), filePath);
        
        console.log(`SIMULACIÓN: Ruta completa del archivo: ${fullPath}`);
        console.log("--- CONTENIDO ORIGINAL (PRIMEROS 500 CARACTERES) ---");
        console.log(originalContent.substring(0, 500) + (originalContent.length > 500 ? "..." : ""));
        console.log("--- CONTENIDO SUGERIDO (PRIMEROS 500 CARACTERES) ---");
        console.log(suggestedContent.substring(0, 500) + (suggestedContent.length > 500 ? "..." : ""));

        if (isSimulation) {
            console.log(`SIMULACIÓN: El archivo ${filePath} se habría actualizado con el contenido sugerido si la escritura estuviera habilitada.`);
            console.log("SIMULACIÓN: No se han realizado cambios reales en el sistema de archivos.");
            // Devolvemos el suggestedContent como newContent para que la UI pueda reflejar el cambio simulado.
            return { success: true, newContent: suggestedContent };
        } else {
            // ESTE BLOQUE NO SE EJECUTARÁ A MENOS QUE isSimulation = false (¡PELIGROSO!)
            // En una aplicación real, esto necesitaría:
            // 1. Confirmación del usuario MUY explícita.
            // 2. Validación exhaustiva del filePath y contenido.
            // 3. Estrategia de backup/rollback.
            // 4. Posiblemente integración con herramientas de diff/patch.
            
            // Verificar si el archivo existe antes de intentar leerlo o escribirlo (si no es simulación)
            try {
                await fs.access(fullPath); // Verifica la existencia y permisos (aunque puede haber TOCTOU)
            } catch (accessError) {
                 console.error(`SIMULACIÓN: Error de acceso al archivo ${filePath} antes de la escritura:`, accessError);
                 return { success: false, error: `El archivo ${filePath} no es accesible.` };
            }

            // Leer el contenido actual para verificar si coincide (muy básico)
            // const currentContentOnDisk = await fs.readFile(fullPath, 'utf-8');
            // if (currentContentOnDisk.trim() !== originalContent.trim()) {
            //     console.warn("El contenido del archivo en disco ha cambiado desde que se generó la sugerencia.");
            //     // return { success: false, error: "El contenido del archivo ha cambiado. Por favor, vuelve a analizar." };
            // }
            // Escribir el nuevo contenido
            // await fs.writeFile(fullPath, suggestedContent, 'utf-8');
            // console.log(`REAL: El archivo ${filePath} ha sido actualizado con el contenido sugerido.`);
            // return { success: true, newContent: suggestedContent };
            return { success: false, error: "La escritura real de archivos está deshabilitada en esta función."}; // Seguridad
        }

    } catch (error) {
        console.error(`SIMULACIÓN: Error al intentar aplicar el cambio al archivo ${filePath}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido al aplicar el cambio.";
        return { success: false, error: errorMessage };
    }
}
