
'use server';

import { analyzeCodeAlchemistSource, AnalyzeCodeAlchemistSourceInput, AnalyzeCodeAlchemistSourceOutput } from '@/ai/flows/analyze-codealchemist-source-flow';
import { suggestErrorFix, SuggestErrorFixInput, SuggestErrorFixOutput } from '@/ai/flows/suggest-error-fix-flow';
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
  detailedExecutionLogs?: string[];
}

// Reducido para evitar "Payload Too Large". Asumiendo ~1.9 chars/token y un límite de ~5200 tokens para contenido.
// Aún más reducido a 7500 para dar más margen al prompt y evitar 413.
const MAX_CHARS_PER_CHUNK = 7500; 
const GROQ_API_TIMEOUT_MS = 60000 * 1; // 1 minuto por chunk

export async function handleAutoAnalyzeAppSource(
  apiKey: string,
  modelName: string,
  analysisPreferences?: string
): Promise<AutoUpdateAnalysisResult> {
  const executionLogs: string[] = [];
  const log = (message: string) => { 
    const timestampedMessage = `[${new Date().toISOString()}] ${message}`;
    console.log(timestampedMessage); 
    executionLogs.push(timestampedMessage); 
  };
  const logError = (message: string) => {
    const timestampedMessage = `[ERROR ${new Date().toISOString()}] ${message}`;
    console.error(timestampedMessage);
    executionLogs.push(timestampedMessage);
  };


  if (!apiKey || !modelName) {
    logError("La clave API y el nombre del modelo son obligatorios.");
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes.", chunksProcessed: 0, totalChunks: 0, detailedExecutionLogs: executionLogs };
  }

  log("Iniciando obtención del paquete de código fuente de la aplicación.");
  const sourceBundleResult = await getApplicationSourceBundle(false, executionLogs); 
  if (sourceBundleResult.logs) { // Merge logs from getApplicationSourceBundle
    // executionLogs.push(...sourceBundleResult.logs); // Already passed and modified by reference
  }

  if (!sourceBundleResult.success || !sourceBundleResult.files || sourceBundleResult.files.length === 0) {
    const errorMsg = sourceBundleResult.error || "No se pudo obtener el código fuente para analizar.";
    logError(`Error al obtener el código fuente: ${errorMsg}`);
    return { success: false, error: errorMsg, chunksProcessed: 0, totalChunks: 0, detailedExecutionLogs: executionLogs };
  }
  log(`Paquete de código fuente obtenido con ${sourceBundleResult.files.length} archivos.`);

  const files = sourceBundleResult.files;
  const chunks: string[] = [];
  let currentChunk = "";
  let currentChunkChars = 0;

  log("Iniciando división del código fuente en fragmentos.");
  for (const file of files) {
    const baseFileName = file.fileName;
    let fileEffectiveContent = file.content;

    // Handle individual files that are too large by splitting them
    if (fileEffectiveContent.length + `\n\n// --- Archivo: ${baseFileName} ---\n\n`.length > MAX_CHARS_PER_CHUNK) {
      if (currentChunk.length > 0) { // Push any existing partial chunk
        chunks.push(currentChunk);
        log(`Fragmento parcial anterior (${currentChunk.length} caracteres) añadido antes de dividir archivo grande.`);
        currentChunk = "";
        currentChunkChars = 0;
      }
      
      let offset = 0;
      let partIndex = 1;
      log(`Archivo ${baseFileName} (${fileEffectiveContent.length} caracteres) es demasiado grande, dividiendo...`);
      while(offset < fileEffectiveContent.length) {
        const partMarker = `\n\n// --- Archivo: ${baseFileName} (parte ${partIndex}) ---\n\n`;
        const charsToTake = MAX_CHARS_PER_CHUNK - partMarker.length;
        if (charsToTake <=0) { 
            logError(`El marcador para ${baseFileName} (parte ${partIndex}) es demasiado largo (${partMarker.length}) para el tamaño del fragmento (MAX_CHARS_PER_CHUNK: ${MAX_CHARS_PER_CHUNK}). Omitiendo parte.`);
            break; 
        }
        const part = fileEffectiveContent.substring(offset, offset + charsToTake);
        chunks.push(partMarker + part);
        log(`Archivo ${baseFileName} (parte ${partIndex}) creado, tamaño ${part.length} caracteres.`);
        offset += part.length; 
        partIndex++;
      }
      continue; 
    }

    const fileContentMarker = `\n\n// --- Archivo: ${baseFileName} ---\n\n`;
    if (currentChunkChars + fileEffectiveContent.length + fileContentMarker.length > MAX_CHARS_PER_CHUNK) {
      if (currentChunk.length > 0) { 
        chunks.push(currentChunk);
        log(`Fragmento actual (${currentChunk.length} caracteres) añadido, iniciando nuevo fragmento con ${baseFileName}.`);
      }
      currentChunk = fileContentMarker + fileEffectiveContent;
      currentChunkChars = fileEffectiveContent.length + fileContentMarker.length;
    } else { 
      currentChunk += fileContentMarker + fileEffectiveContent;
      currentChunkChars += fileEffectiveContent.length + fileContentMarker.length;
      log(`Archivo ${baseFileName} (${fileEffectiveContent.length} caracteres) añadido al fragmento actual. Tamaño actual del fragmento: ${currentChunkChars}.`);
    }
  }

  if (currentChunk.length > 0) { 
    chunks.push(currentChunk);
    log(`Fragmento restante (${currentChunk.length} caracteres) añadido.`);
  }

  const totalChunks = chunks.length;
  if (totalChunks === 0) {
    logError("No se generaron fragmentos de código para analizar.");
    return { success: false, error: "No se generaron fragmentos de código para analizar.", chunksProcessed: 0, totalChunks: 0, detailedExecutionLogs: executionLogs };
  }
  
  log(`Código fuente dividido en ${totalChunks} fragmentos para análisis. MAX_CHARS_PER_CHUNK: ${MAX_CHARS_PER_CHUNK}`);
  chunks.forEach((c, i) => log(`Fragmento ${i+1} tamaño: ${c.length} caracteres`));

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
      log(`Analizando fragmento ${processedChunks + 1} de ${totalChunks}... (${chunk.length} caracteres) con timeout de ${GROQ_API_TIMEOUT_MS / 1000}s y modelo ${modelName}`);
      const result = await analyzeCodeAlchemistSource(input);
      allResults.push(result);
      processedChunks++;
      log(`Progreso: ${processedChunks}/${totalChunks} fragmentos procesados. Fragmento ${processedChunks} completado.`);
    } catch (error) {
      let errorMessage = "Ocurrió un error desconocido durante el análisis de un fragmento.";
      if (error instanceof Error) {
        errorMessage = error.message; 
      }
      logError(`Error analizando el fragmento ${processedChunks + 1}: ${errorMessage}`);
      return { success: false, error: `Falló el análisis del fragmento ${processedChunks + 1}: ${errorMessage}`, chunksProcessed: processedChunks, totalChunks: totalChunks, detailedExecutionLogs: executionLogs };
    }
  }

  if (allResults.length === 0) {
    logError("No se obtuvieron resultados del análisis de los fragmentos.");
    return { success: false, error: "No se obtuvieron resultados del análisis de los fragmentos.", chunksProcessed: processedChunks, totalChunks: totalChunks, detailedExecutionLogs: executionLogs };
  }
  log(`Análisis de todos los ${processedChunks} fragmentos completado. Agregando resultados.`);

  const aggregatedResult: AnalyzeCodeAlchemistSourceOutput = {
    analysisTitle: allResults[0].analysisTitle || `Análisis Agregado de ${totalChunks} Fragmentos`,
    identifiedAreas: Array.from(new Set(allResults.flatMap(r => r.identifiedAreas))),
    suggestions: allResults.flatMap(r => r.suggestions.map(s => ({...s, area: s.area || "General (Fragmento)" }))), 
    overallAssessment: allResults.map(r => r.overallAssessment).join('\n\n---\n\n'),
  };
  log("Resultados agregados exitosamente.");
  
  return { success: true, data: aggregatedResult, chunksProcessed: processedChunks, totalChunks: totalChunks, detailedExecutionLogs: executionLogs };
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
  logs?: string[]; // Logs generated by this function
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

export async function getApplicationSourceBundle(
  concatenate: boolean = false,
  executionLogs?: string[] // Optional: pass array to append logs
): Promise<AppSourceBundleResult> {
  const internalLogs: string[] = [];
  const log = (message: string) => {
    const logMsg = `[SourceBundle] ${message}`;
    console.log(logMsg);
    internalLogs.push(logMsg);
    if (executionLogs) executionLogs.push(logMsg);
  };
  const warnLog = (message: string) => {
    const logMsg = `[SourceBundle_WARN] ${message}`;
    console.warn(logMsg);
    internalLogs.push(logMsg);
    if (executionLogs) executionLogs.push(logMsg);
  };
   const errorLog = (message: string) => {
    const logMsg = `[SourceBundle_ERROR] ${message}`;
    console.error(logMsg);
    internalLogs.push(logMsg);
    if (executionLogs) executionLogs.push(logMsg);
  };


  try {
    const projectRoot = process.cwd();
    log(`Obteniendo lista de archivos desde: ${projectRoot} con patrones de ignorados.`);
    const allFiles = await glob('**/*', { 
      cwd: projectRoot, 
      nodir: true, 
      dot: true, 
      ignore: ignorePatterns,
      follow: false, 
    });
    log(`Se encontraron ${allFiles.length} archivos después del filtrado inicial.`);

    const filesData: AppSourceFile[] = [];
    let concatenatedContent = "";

    for (const relativeFilePath of allFiles) {
      try {
        const fullPath = path.join(projectRoot, relativeFilePath);
        const stats = await fs.stat(fullPath);
        
        log(`Procesando archivo: ${relativeFilePath}, tamaño: ${stats.size} bytes.`);

        if (concatenate && stats.size > 500 * 1024) { 
            warnLog(`Archivo omitido de la concatenación por tamaño: ${relativeFilePath} (${(stats.size / 1024).toFixed(2)} KB)`);
            const message = `// Archivo ${relativeFilePath} omitido de la concatenación por ser demasiado grande (${(stats.size / 1024).toFixed(2)} KB).\n`;
            concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${message}`;
            filesData.push({ fileName: relativeFilePath, content: message });
            continue;
        }

        let content: string;
        try {
          content = await fs.readFile(fullPath, 'utf-8');
          log(`Contenido de ${relativeFilePath} leído exitosamente.`);
        } catch (readError) {
          const error = readError as NodeJS.ErrnoException;
          warnLog(`No se pudo leer el archivo ${relativeFilePath} como texto (podría ser binario): ${error.message}`);
          content = `// Error: No se pudo leer el archivo ${relativeFilePath} como texto. Puede ser un archivo binario o corrupto.`;
           if (!concatenate && (error.code === 'EILSEQ' || stats.size > 1024 * 1024) ) { // 1MB limit for non-concatenated binary content in ZIP
             filesData.push({ fileName: relativeFilePath, content: "// Archivo binario o no legible, contenido omitido para ZIP." });
             warnLog(`Contenido de ${relativeFilePath} omitido para ZIP (binario/grande no concatenado).`);
             continue; 
           }
        }
        
        filesData.push({ fileName: relativeFilePath, content });
        if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
          log(`Contenido de ${relativeFilePath} añadido a la concatenación.`);
        }
      } catch (fileProcessingError) {
        const error = fileProcessingError as NodeJS.ErrnoException;
        if (error.code !== 'EACCES' && error.code !== 'EISDIR') { // Filter out common access/dir errors
            warnLog(`No se pudo procesar el archivo ${relativeFilePath} para el paquete fuente: ${error.message}`);
        }
        const errorMessage = `// Error: No se pudo procesar el archivo. (${error.message})`;
        filesData.push({ fileName: relativeFilePath, content: errorMessage });
         if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${errorMessage}`;
        }
      }
    }

    if (filesData.length === 0) {
        warnLog("No se pudieron leer archivos fuente para el paquete después del procesamiento.");
        return { success: false, error: "No se pudieron leer archivos fuente para el paquete.", logs: internalLogs };
    }
    log(`Paquete de código fuente finalizado con ${filesData.length} entradas de archivo.`);
    return { success: true, files: filesData, concatenatedSource: concatenate ? concatenatedContent : undefined, logs: internalLogs };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
    errorLog(`Error empaquetando el código fuente de la aplicación: ${errorMessage}`);
    return { success: false, error: `Falló la obtención del paquete de código fuente: ${errorMessage}`, logs: internalLogs };
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


interface AutoFixSuggestionResult {
  success: boolean;
  data?: SuggestErrorFixOutput;
  error?: string;
}

export async function handleGetErrorFixSuggestion(
  errorMessage: string,
  apiKey: string,
  modelName: string
): Promise<AutoFixSuggestionResult> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios para la auto-corrección." };
  }

  const groqOptions: GroqOptions = {
    apiKey,
    modelName,
    timeoutMs: GROQ_API_TIMEOUT_MS, // Usar el mismo timeout general
  };

  const input: SuggestErrorFixInput = {
    error_message: errorMessage,
    context: "Error ocurrido durante la función AutoUpdate (análisis del propio código de YskCodeAlchemist).",
    groqOptions: groqOptions,
  };

  try {
    const result = await suggestErrorFix(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error obteniendo sugerencia para la corrección:", error);
    let specificErrorMessage = "Ocurrió un error desconocido al intentar obtener una sugerencia de corrección.";
    if (error instanceof Error) {
      specificErrorMessage = error.message;
    }
    return { success: false, error: `Falló la obtención de sugerencia para corrección: ${specificErrorMessage}` };
  }
}

