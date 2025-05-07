'use server';

import { analyzeCodeAlchemistSource, AnalyzeCodeAlchemistSourceInput, AnalyzeCodeAlchemistSourceOutput } from '@/ai/flows/analyze-codealchemist-source-flow';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob'; 
import type { GroqOptions } from '@/services/groq'; // Import GroqOptions

interface AutoUpdateAnalysisResult {
  success: boolean;
  data?: AnalyzeCodeAlchemistSourceOutput;
  error?: string;
  chunksProcessed?: number;
  totalChunks?: number;
}

// Estimación: 1 token ~ 3 caracteres. Límite de 6000 tokens para el contenido.
// Dejamos un margen para el prompt y la respuesta JSON.
const MAX_CHARS_PER_CHUNK = 5500 * 3; // Aproximadamente 16500 caracteres
const GROQ_API_TIMEOUT_MS = 60000 * 1; // 1 minuto por chunk

export async function handleAutoAnalyzeAppSource(
  apiKey: string,
  modelName: string,
  analysisPreferences?: string,
  onProgress?: (progress: { processed: number; total: number }) => void
): Promise<AutoUpdateAnalysisResult> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }

  const sourceBundleResult = await getApplicationSourceBundle(false); 
  if (!sourceBundleResult.success || !sourceBundleResult.files || sourceBundleResult.files.length === 0) {
    return { success: false, error: sourceBundleResult.error || "No se pudo obtener el código fuente para analizar." };
  }

  const files = sourceBundleResult.files;
  const chunks: string[] = [];
  let currentChunk = "";
  let currentChunkChars = 0;

  for (const file of files) {
    const fileContentMarker = `\n\n// --- Archivo: ${file.fileName} ---\n\n`;
    const fileEffectiveContent = file.content; 

    if (fileEffectiveContent.length + fileContentMarker.length > MAX_CHARS_PER_CHUNK) {
      if (currentChunkChars > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
        currentChunkChars = 0;
      }
      let processedFileContent = fileEffectiveContent;
      if (fileEffectiveContent.length > MAX_CHARS_PER_CHUNK * 2) { 
        console.warn(`Archivo ${file.fileName} truncado debido a su tamaño excesivo (${fileEffectiveContent.length} caracteres). Solo se procesarán los primeros ${MAX_CHARS_PER_CHUNK * 2} caracteres.`);
        processedFileContent = fileEffectiveContent.substring(0, MAX_CHARS_PER_CHUNK * 2);
      }
      chunks.push(fileContentMarker + processedFileContent);

    } else if (currentChunkChars + fileEffectiveContent.length + fileContentMarker.length > MAX_CHARS_PER_CHUNK) {
      chunks.push(currentChunk);
      currentChunk = fileContentMarker + fileEffectiveContent;
      currentChunkChars = fileEffectiveContent.length + fileContentMarker.length;
    } else {
      currentChunk += fileContentMarker + fileEffectiveContent;
      currentChunkChars += fileEffectiveContent.length + fileContentMarker.length;
    }
  }

  if (currentChunkChars > 0) {
    chunks.push(currentChunk);
  }

  if (chunks.length === 0) {
    return { success: false, error: "No se generaron fragmentos de código para analizar." };
  }
  
  console.log(`Código fuente dividido en ${chunks.length} fragmentos para análisis.`);

  const allResults: AnalyzeCodeAlchemistSourceOutput[] = [];
  let processedChunks = 0;

  const groqAPIOptions: GroqOptions = {
    apiKey: apiKey,
    modelName: modelName,
    timeoutMs: GROQ_API_TIMEOUT_MS
  };

  for (const chunk of chunks) {
    const input: AnalyzeCodeAlchemistSourceInput = {
      sourceCode: chunk, 
      groqOptions: groqAPIOptions, // Pasar las opciones completas
      analysisPreferences,
    };

    try {
      console.log(`Analizando fragmento ${processedChunks + 1} de ${chunks.length}... (${chunk.length} caracteres) con timeout de ${GROQ_API_TIMEOUT_MS / 1000}s`);
      const result = await analyzeCodeAlchemistSource(input);
      allResults.push(result);
      processedChunks++;
      if (onProgress) { 
         console.log(`Progreso: ${processedChunks}/${chunks.length}`);
      }
    } catch (error) {
      console.error(`Error analizando el fragmento ${processedChunks + 1}:`, error);
      let errorMessage = "Ocurrió un error desconocido durante el análisis de un fragmento.";
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.toLowerCase().includes("timeout") || error.message.toLowerCase().includes("excedió el tiempo límite")) {
          errorMessage = `El análisis del fragmento ${processedChunks + 1} excedió el tiempo límite de ${GROQ_API_TIMEOUT_MS / 1000} segundos. Intenta de nuevo o revisa la configuración.`;
        }
      }
      return { success: false, error: `Falló el análisis del fragmento ${processedChunks + 1}: ${errorMessage}`, chunksProcessed: processedChunks, totalChunks: chunks.length };
    }
  }

  if (allResults.length === 0) {
    return { success: false, error: "No se obtuvieron resultados del análisis de los fragmentos." };
  }

  const aggregatedResult: AnalyzeCodeAlchemistSourceOutput = {
    analysisTitle: allResults[0].analysisTitle || `Análisis Agregado de ${chunks.length} Fragmentos`,
    identifiedAreas: Array.from(new Set(allResults.flatMap(r => r.identifiedAreas))),
    suggestions: allResults.flatMap(r => r.suggestions.map(s => ({...s, area: s.area || "General (Fragmento)" }))), 
    overallAssessment: allResults.map(r => r.overallAssessment).join('\n\n---\n\n'),
  };
  
  return { success: true, data: aggregatedResult, chunksProcessed: processedChunks, totalChunks: chunks.length };
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
  '*.zip', 
  '.DS_Store',
  '*.log',
  'build/**',
  'dist/**',
  '.env', 
  '.env.local', 
  '.env.development',
  '.env.production',
  '.env.test',
  'public/mockServiceWorker.js', // Ignorar el mock service worker si existe
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
        const stats = await fs.stat(path.join(projectRoot, relativeFilePath));
        
        if (concatenate && stats.size > 500 * 1024) { 
            console.warn(`Archivo omitido de la concatenación por tamaño: ${relativeFilePath} (${(stats.size / 1024).toFixed(2)} KB)`);
            const message = `// Archivo ${relativeFilePath} omitido de la concatenación por ser demasiado grande (${(stats.size / 1024).toFixed(2)} KB).\n`;
            concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${message}`;
            filesData.push({ fileName: relativeFilePath, content: message });
            continue;
        }


        const fullPath = path.join(projectRoot, relativeFilePath);
        let content: string;
        try {
          content = await fs.readFile(fullPath, 'utf-8');
        } catch (readError) {
          const error = readError as NodeJS.ErrnoException;
          console.warn(`No se pudo leer el archivo ${relativeFilePath} como texto (podría ser binario): ${error.message}`);
          content = `// Error: No se pudo leer el archivo ${relativeFilePath} como texto. Puede ser un archivo binario o corrupto.`;
           if (!concatenate && (error.code === 'EILSEQ' || stats.size > 1024 * 1024) ) {
             filesData.push({ fileName: relativeFilePath, content: "// Archivo binario o no legible, contenido omitido para ZIP." });
             continue; 
           }
        }
        
        filesData.push({ fileName: relativeFilePath, content });
        if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
        }
      } catch (fileProcessingError) {
        const error = fileProcessingError as NodeJS.ErrnoException;
        if (error.code !== 'EACCES' && error.code !== 'EISDIR') {
            console.warn(`No se pudo procesar el archivo ${relativeFilePath} para el paquete fuente:`, error);
        }
        const errorMessage = `// Error: No se pudo procesar el archivo. (${error.message})`;
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


export async function applySuggestedChange(filePath: string, originalContent: string, suggestedContent: string): Promise<{success: boolean, error?: string, newContent?: string}> {
    console.log(`SIMULACIÓN: Intentando aplicar cambio a: ${filePath}`);
    
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
            return { success: true, newContent: suggestedContent };
        } else {
            // ESTE BLOQUE NO SE EJECUTARÁ
            try {
                await fs.access(fullPath); 
            } catch (accessError) {
                 console.error(`SIMULACIÓN: Error de acceso al archivo ${filePath} antes de la escritura:`, accessError);
                 return { success: false, error: `El archivo ${filePath} no es accesible.` };
            }
            // await fs.writeFile(fullPath, suggestedContent, 'utf-8'); // DESACTIVADO
            // console.log(`REAL: El archivo ${filePath} ha sido actualizado con el contenido sugerido.`);
            // return { success: true, newContent: suggestedContent };
            return { success: false, error: "La escritura real de archivos está deshabilitada en esta función."};
        }

    } catch (error) {
        console.error(`SIMULACIÓN: Error al intentar aplicar el cambio al archivo ${filePath}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido al aplicar el cambio.";
        return { success: false, error: errorMessage };
    }
}
