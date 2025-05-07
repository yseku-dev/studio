
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

// Reducido para evitar "Payload Too Large". Asumiendo ~1.9 chars/token y un límite de ~5200 tokens para contenido.
// Aún más reducido a 7500 para dar más margen al prompt y evitar 413.
const MAX_CHARS_PER_CHUNK = 7500; 
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
    const baseFileName = file.fileName;
    let fileEffectiveContent = file.content;

    // Handle individual files that are too large by splitting them
    if (fileEffectiveContent.length + `\n\n// --- Archivo: ${baseFileName} ---\n\n`.length > MAX_CHARS_PER_CHUNK) {
      if (currentChunk.length > 0) { // Push any existing partial chunk
        chunks.push(currentChunk);
        currentChunk = "";
        currentChunkChars = 0;
      }
      
      let offset = 0;
      let partIndex = 1;
      while(offset < fileEffectiveContent.length) {
        const partMarker = `\n\n// --- Archivo: ${baseFileName} (parte ${partIndex}) ---\n\n`;
        const charsToTake = MAX_CHARS_PER_CHUNK - partMarker.length;
        if (charsToTake <=0) { // Marker itself is too long, highly unlikely but a safeguard
            console.error(`El marcador para ${baseFileName} es demasiado largo para el tamaño del fragmento.`);
            break; 
        }
        const part = fileEffectiveContent.substring(offset, offset + charsToTake);
        chunks.push(partMarker + part);
        offset += part.length; // Use part.length because substring might return less if at end
        partIndex++;
        console.warn(`Archivo ${baseFileName} dividido en múltiples fragmentos. Fragmento procesado de ${part.length} caracteres.`);
      }
      continue; // Move to the next file
    }

    // If adding this file (which is not too large by itself) would make the current chunk too large
    const fileContentMarker = `\n\n// --- Archivo: ${baseFileName} ---\n\n`;
    if (currentChunkChars + fileEffectiveContent.length + fileContentMarker.length > MAX_CHARS_PER_CHUNK) {
      if (currentChunk.length > 0) { // Push the current chunk before starting a new one
        chunks.push(currentChunk);
      }
      currentChunk = fileContentMarker + fileEffectiveContent;
      currentChunkChars = fileEffectiveContent.length + fileContentMarker.length;
    } else { // Add to the current chunk
      currentChunk += fileContentMarker + fileEffectiveContent;
      currentChunkChars += fileEffectiveContent.length + fileContentMarker.length;
    }
  }

  if (currentChunk.length > 0) { // Push any remaining chunk
    chunks.push(currentChunk);
  }

  if (chunks.length === 0) {
    return { success: false, error: "No se generaron fragmentos de código para analizar." };
  }
  
  console.log(`Código fuente dividido en ${chunks.length} fragmentos para análisis. MAX_CHARS_PER_CHUNK: ${MAX_CHARS_PER_CHUNK}`);
  chunks.forEach((c, i) => console.log(`Fragmento ${i+1} tamaño: ${c.length} caracteres`));

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
      groqOptions: groqAPIOptions, 
      analysisPreferences,
    };

    try {
      console.log(`Analizando fragmento ${processedChunks + 1} de ${chunks.length}... (${chunk.length} caracteres) con timeout de ${GROQ_API_TIMEOUT_MS / 1000}s y modelo ${modelName}`);
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
        errorMessage = error.message; // fetchWithRetry en groq.ts ya maneja timeouts y rate limits con mensajes específicos
      }
      return { success: false, error: `Falló el análisis del fragmento ${processedChunks + 1}: ${errorMessage}`, chunksProcessed: processedChunks, totalChunks: chunks.length };
    }
  }

  if (allResults.length === 0) {
    return { success: false, error: "No se obtuvieron resultados del análisis de los fragmentos." };
  }

  // Agregación de resultados
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
  'public/mockServiceWorker.js', 
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
