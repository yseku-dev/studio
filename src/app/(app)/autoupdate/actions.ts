
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
    const timestampedMessage = `[INFO ${new Date().toISOString()}] ${message}`;
    console.log(timestampedMessage); 
    executionLogs.push(timestampedMessage); 
  };
  const logDetail = (message: string) => {
    const timestampedMessage = `[DETAIL ${new Date().toISOString()}] ${message}`;
    // console.log(timestampedMessage); // Optional: console log for detail too
    executionLogs.push(timestampedMessage);
  };
  const logWarn = (message: string) => {
    const timestampedMessage = `[WARN ${new Date().toISOString()}] ${message}`;
    console.warn(timestampedMessage);
    executionLogs.push(timestampedMessage);
  };
  const logError = (message: string, error?: any) => {
    let fullMessage = `[ERROR ${new Date().toISOString()}] ${message}`;
    if (error) {
      let errorDetail = "No se pudo serializar el detalle del error.";
      try {
        errorDetail = error instanceof Error ? error.message : JSON.stringify(error);
      } catch (e) {
        // Fallback if JSON.stringify fails
        if (error instanceof Error) {
            errorDetail = error.message;
        } else if (typeof error.toString === 'function') {
            errorDetail = error.toString();
        }
        // else errorDetail remains "No se pudo serializar el detalle del error."
      }
      fullMessage += ` | Detalle: ${errorDetail}`;

      if (error instanceof Error && error.stack) {
        fullMessage += ` | Stack: ${error.stack.substring(0, 500)}...`; // Truncate stack for brevity in logs
      }
    }
    console.error(fullMessage);
    executionLogs.push(fullMessage);
  };


  log("Iniciando auto-análisis de la aplicación.");
  if (!apiKey || !modelName) {
    logError("Configuración de API incompleta. Clave API y nombre de modelo son obligatorios.");
    return { 
      success: false, 
      error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes.", 
      chunksProcessed: 0, 
      totalChunks: 0, 
      detailedExecutionLogs: executionLogs 
    };
  }
  log(`Usando modelo: ${modelName}. Preferencias de análisis: ${analysisPreferences || 'Ninguna'}.`);

  log("Obteniendo paquete de código fuente de la aplicación...");
  const sourceBundleResult = await getApplicationSourceBundle(false, executionLogs); 

  if (!sourceBundleResult.success || !sourceBundleResult.files || sourceBundleResult.files.length === 0) {
    const errorMsg = sourceBundleResult.error || "No se pudo obtener el código fuente para analizar.";
    logError(`Fallo al obtener el código fuente: ${errorMsg}`);
    return { 
      success: false, 
      error: errorMsg, 
      chunksProcessed: 0, 
      totalChunks: 0, 
      detailedExecutionLogs: executionLogs 
    };
  }
  log(`Paquete de código fuente obtenido con ${sourceBundleResult.files.length} archivos.`);

  const files = sourceBundleResult.files;
  const chunks: string[] = [];
  let currentChunk = "";
  let currentChunkChars = 0;
  let totalSourceChars = 0;
  files.forEach(f => totalSourceChars += f.content.length);

  log(`Iniciando división del código fuente en fragmentos. Total de caracteres en fuente: ${totalSourceChars}. MAX_CHARS_PER_CHUNK: ${MAX_CHARS_PER_CHUNK}.`);
  
  for (const file of files) {
    logDetail(`Procesando archivo para fragmentación: ${file.fileName} (${file.content.length} caracteres).`);
    const baseFileName = file.fileName;
    let fileEffectiveContent = file.content;

    const fileMarkerTemplate = `\n\n// --- Archivo: ${baseFileName}{part_info} ---\n\n`;
    const fileMarkerLength = fileMarkerTemplate.replace("{part_info}", "").length; // Approx length without part info

    if (fileEffectiveContent.length + fileMarkerLength > MAX_CHARS_PER_CHUNK) {
      logDetail(`Archivo ${baseFileName} es demasiado grande (${fileEffectiveContent.length} caracteres) para un solo fragmento, se dividirá.`);
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        logDetail(`Fragmento parcial anterior (${currentChunk.length} caracteres) añadido antes de dividir archivo grande.`);
        currentChunk = "";
        currentChunkChars = 0;
      }
      
      let offset = 0;
      let partIndex = 1;
      while(offset < fileEffectiveContent.length) {
        const partInfo = ` (parte ${partIndex})`;
        const partMarker = fileMarkerTemplate.replace("{part_info}", partInfo);
        const charsToTake = MAX_CHARS_PER_CHUNK - partMarker.length;
        
        if (charsToTake <= 0) { 
            logError(`El marcador para ${baseFileName}${partInfo} es demasiado largo (${partMarker.length}) para el tamaño del fragmento (MAX_CHARS_PER_CHUNK: ${MAX_CHARS_PER_CHUNK}). Omitiendo esta parte del archivo.`);
            break; 
        }
        const part = fileEffectiveContent.substring(offset, offset + charsToTake);
        chunks.push(partMarker + part);
        logDetail(`Archivo ${baseFileName}${partInfo} creado como fragmento, tamaño de contenido ${part.length} caracteres.`);
        offset += part.length; 
        partIndex++;
      }
      continue; 
    }

    const fileContentMarker = fileMarkerTemplate.replace("{part_info}", "");
    if (currentChunkChars + fileEffectiveContent.length + fileContentMarker.length > MAX_CHARS_PER_CHUNK) {
      if (currentChunk.length > 0) { 
        chunks.push(currentChunk);
        logDetail(`Fragmento actual (${currentChunk.length} caracteres) añadido. Iniciando nuevo fragmento con ${baseFileName}.`);
      }
      currentChunk = fileContentMarker + fileEffectiveContent;
      currentChunkChars = fileEffectiveContent.length + fileContentMarker.length;
    } else { 
      currentChunk += fileContentMarker + fileEffectiveContent;
      currentChunkChars += fileEffectiveContent.length + fileContentMarker.length;
    }
    logDetail(`Archivo ${baseFileName} (${fileEffectiveContent.length} caracteres) añadido al fragmento actual. Tamaño actual del fragmento: ${currentChunkChars}.`);
  }

  if (currentChunk.length > 0) { 
    chunks.push(currentChunk);
    logDetail(`Fragmento restante (${currentChunk.length} caracteres) añadido.`);
  }

  const totalChunks = chunks.length;
  log(`División del código fuente completada. Total de fragmentos generados: ${totalChunks}.`);
  if (chunks.length > 0) {
    chunks.forEach((c, i) => logDetail(`Fragmento ${i+1}/${totalChunks} - Tamaño: ${c.length} caracteres.`));
  }


  if (totalChunks === 0) {
    logWarn("No se generaron fragmentos de código para analizar. Esto puede ocurrir si no hay archivos o son muy pequeños.");
    return { 
      success: true, // Success in the sense that the process ran, but no analysis done.
      data: { analysisTitle: "Sin Contenido para Analizar", identifiedAreas: [], suggestions: [], overallAssessment: "No se encontraron archivos o contenido para analizar." },
      chunksProcessed: 0, 
      totalChunks: 0, 
      detailedExecutionLogs: executionLogs 
    };
  }
  
  const allResults: AnalyzeCodeAlchemistSourceOutput[] = [];
  let processedChunks = 0;

  const groqAPIOptions: GroqOptions = {
    apiKey: apiKey,
    modelName: modelName,
    timeoutMs: GROQ_API_TIMEOUT_MS
  };

  for (const chunk of chunks) {
    const currentChunkNum = processedChunks + 1;
    log(`Iniciando análisis del fragmento ${currentChunkNum} de ${totalChunks}... (Tamaño: ${chunk.length} caracteres). Timeout: ${GROQ_API_TIMEOUT_MS / 1000}s.`);
    
    const input: AnalyzeCodeAlchemistSourceInput = {
      sourceCode: chunk, 
      groqOptions: groqAPIOptions, 
      analysisPreferences,
    };

    try {
      const result = await analyzeCodeAlchemistSource(input);
      allResults.push(result);
      processedChunks++;
      log(`Fragmento ${currentChunkNum}/${totalChunks} procesado exitosamente.`);
      logDetail(`Respuesta del fragmento ${currentChunkNum}: ${JSON.stringify(result).substring(0,200)}...`);
    } catch (error) {
      let errorMessage = "Ocurrió un error desconocido durante el análisis de un fragmento.";
      if (error instanceof Error) {
        errorMessage = error.message; 
      }
      logError(`Error analizando el fragmento ${currentChunkNum}/${totalChunks}.`, error);
      // Devolver el error, los fragmentos procesados hasta ahora y los logs
      return { 
        success: false, 
        error: `Falló el análisis del fragmento ${currentChunkNum}: ${errorMessage}`, 
        chunksProcessed: processedChunks, 
        totalChunks: totalChunks, 
        detailedExecutionLogs: executionLogs 
      };
    }
  }

  if (allResults.length === 0 && totalChunks > 0) { // totalChunks > 0 para evitar este error si no había nada que procesar.
    logError("No se obtuvieron resultados del análisis de los fragmentos, aunque se procesaron algunos o todos.");
    return { 
        success: false, 
        error: "No se obtuvieron resultados del análisis de los fragmentos.", 
        chunksProcessed: processedChunks, 
        totalChunks: totalChunks, 
        detailedExecutionLogs: executionLogs 
    };
  }
  log(`Análisis de todos los ${processedChunks} fragmentos completado. Agregando resultados...`);

  const aggregatedResult: AnalyzeCodeAlchemistSourceOutput = {
    analysisTitle: allResults.length > 0 && allResults[0].analysisTitle ? `${allResults[0].analysisTitle} (Agregado)` : `Análisis Agregado de ${totalChunks} Fragmentos`,
    identifiedAreas: Array.from(new Set(allResults.flatMap(r => r.identifiedAreas || []))),
    suggestions: allResults.flatMap(r => (r.suggestions || []).map(s => ({...s, area: s.area || "General (Fragmento)" }))), 
    overallAssessment: allResults.map(r => r.overallAssessment || "").join('\n\n---\n\n') || "No se generó una evaluación general agregada.",
  };
  log("Resultados agregados exitosamente.");
  
  return { 
    success: true, 
    data: aggregatedResult, 
    chunksProcessed: processedChunks, 
    totalChunks: totalChunks, 
    detailedExecutionLogs: executionLogs 
  };
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
  logsBuilt?: string[]; // Logs built by this function, to be merged by caller
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
  parentExecutionLogs?: string[] 
): Promise<AppSourceBundleResult> {
  const internalLogs: string[] = [];
  const log = (message: string, level: 'INFO' | 'DETAIL' | 'WARN' | 'ERROR' = 'INFO') => {
    const timestampedMessage = `[SourceBundle ${level} ${new Date().toISOString()}] ${message}`;
    switch(level) {
        case 'INFO': console.log(timestampedMessage); break;
        case 'DETAIL': console.log(timestampedMessage); break; // Could be less verbose if needed
        case 'WARN': console.warn(timestampedMessage); break;
        case 'ERROR': console.error(timestampedMessage); break;
    }
    internalLogs.push(timestampedMessage);
    if (parentExecutionLogs) parentExecutionLogs.push(timestampedMessage);
  };

  log("Iniciando obtención del paquete de código fuente de la aplicación.", 'INFO');
  try {
    const projectRoot = process.cwd();
    log(`Directorio raíz del proyecto: ${projectRoot}. Patrones de ignorados aplicados.`, 'DETAIL');
    
    const allFiles = await glob('**/*', { 
      cwd: projectRoot, 
      nodir: true, 
      dot: true, 
      ignore: ignorePatterns,
      follow: false, 
    });
    log(`Glob encontró ${allFiles.length} rutas de archivo después del filtrado inicial.`, 'INFO');

    if (allFiles.length === 0) {
        log("No se encontraron archivos después de aplicar patrones de ignorados. Verifique los patrones o el contenido del proyecto.", 'WARN');
        return { success: false, error: "No se encontraron archivos para empaquetar.", logsBuilt: internalLogs };
    }

    const filesData: AppSourceFile[] = [];
    let concatenatedContent = "";

    for (const relativeFilePath of allFiles) {
      try {
        const fullPath = path.join(projectRoot, relativeFilePath);
        log(`Procesando archivo: ${relativeFilePath}`, 'DETAIL');
        const stats = await fs.stat(fullPath);
        log(`Estadísticas para ${relativeFilePath}: tamaño ${stats.size} bytes.`, 'DETAIL');

        if (concatenate && stats.size > 500 * 1024) { 
            log(`Archivo omitido de la concatenación por tamaño excesivo: ${relativeFilePath} (${(stats.size / 1024).toFixed(2)} KB)`, 'WARN');
            const message = `// Archivo ${relativeFilePath} omitido de la concatenación por ser demasiado grande (${(stats.size / 1024).toFixed(2)} KB).\n`;
            concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${message}`;
            filesData.push({ fileName: relativeFilePath, content: message }); // Still include in filesData for listing
            continue;
        }

        let content: string;
        try {
          content = await fs.readFile(fullPath, 'utf-8');
          log(`Contenido de ${relativeFilePath} leído exitosamente.`, 'DETAIL');
        } catch (readError) {
          const error = readError as NodeJS.ErrnoException;
          log(`No se pudo leer el archivo ${relativeFilePath} como texto (podría ser binario o error de permisos): ${error.message}. Código: ${error.code}`, 'WARN');
          content = `// Error: No se pudo leer el archivo ${relativeFilePath} como texto. Causa: ${error.message}.`;
           if (!concatenate && (error.code === 'EILSEQ' || stats.size > 1024 * 1024 * 2) ) { // 2MB limit for non-concatenated binary-like content in ZIP
             filesData.push({ fileName: relativeFilePath, content: "// Archivo binario o muy grande no legible, contenido omitido para ZIP." });
             log(`Contenido de ${relativeFilePath} omitido para ZIP (binario/grande o error de lectura no concatenado).`, 'WARN');
             continue; 
           }
        }
        
        filesData.push({ fileName: relativeFilePath, content });
        if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
          log(`Contenido de ${relativeFilePath} añadido a la concatenación.`, 'DETAIL');
        }
      } catch (fileProcessingError) {
        const error = fileProcessingError as NodeJS.ErrnoException;
        // Filter out common access/dir errors that might be expected with broad globs
        if (error.code !== 'EACCES' && error.code !== 'EISDIR' && error.code !== 'ENOENT') { 
            log(`Error al procesar el archivo ${relativeFilePath} para el paquete fuente: ${error.message}. Código: ${error.code}`, 'WARN');
        } else {
            log(`Error de acceso/directorio omitido para ${relativeFilePath}: ${error.message}. Código: ${error.code}`, 'DETAIL');
        }
        const errorMessage = `// Error: No se pudo procesar completamente el archivo ${relativeFilePath}. Causa: ${error.message}`;
        filesData.push({ fileName: relativeFilePath, content: errorMessage }); // Include a placeholder
         if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${errorMessage}`;
        }
      }
    }

    if (filesData.length === 0) {
        log("No se pudieron recopilar datos de archivos fuente después del procesamiento detallado. Esto podría indicar problemas de permisos o estructura.", 'WARN');
        return { success: false, error: "No se pudieron recopilar datos de archivos fuente.", logsBuilt: internalLogs };
    }
    log(`Procesamiento del paquete de código fuente finalizado. Total de entradas de archivo: ${filesData.length}.`, 'INFO');
    return { 
        success: true, 
        files: filesData, 
        concatenatedSource: concatenate ? concatenatedContent : undefined, 
        logsBuilt: internalLogs 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido empaquetando código.";
    log(`Error crítico empaquetando el código fuente de la aplicación: ${errorMessage}`, 'ERROR');
    if (error instanceof Error && error.stack) {
        log(`Stack del error crítico: ${error.stack}`, 'ERROR');
    }
    return { 
        success: false, 
        error: `Falló la obtención del paquete de código fuente: ${errorMessage}`, 
        logsBuilt: internalLogs 
    };
  }
}


export async function applySuggestedChange(
    filePath: string, 
    originalContent: string, // Kept for context, though not used for verification in this version
    suggestedContent: string,
    executionLogs?: string[] // For detailed logging
): Promise<{success: boolean, error?: string, newContent?: string}> {
    const log = (message: string, level: 'INFO' | 'ERROR' = 'INFO') => {
        const timestampedMessage = `[ApplyChange ${level} ${new Date().toISOString()}] ${message}`;
        if (level === 'INFO') console.log(timestampedMessage);
        else console.error(timestampedMessage);
        if (executionLogs) executionLogs.push(timestampedMessage);
    };

    log(`Intentando aplicar cambio al archivo: ${filePath}`, 'INFO');
    
    // const isSimulation = true; // Para desactivar la escritura real
    const isSimulation = false; // Para activar la escritura real

    if (isSimulation) {
        log(`SIMULACIÓN: El archivo ${filePath} se habría actualizado.`, 'INFO');
        log("SIMULACIÓN: No se han realizado cambios reales en el sistema de archivos.", 'INFO');
        log(`SIMULACIÓN: Contenido original (primeros 300 chars): ${originalContent.substring(0,300)}...`, 'INFO');
        log(`SIMULACIÓN: Contenido sugerido (primeros 300 chars): ${suggestedContent.substring(0,300)}...`, 'INFO');
        return { success: true, newContent: suggestedContent }; // Devuelve el contenido sugerido como si se hubiera aplicado
    }

    try {
        const projectRoot = process.cwd();
        const fullPath = path.join(projectRoot, filePath);

        log(`Ruta completa del archivo para escritura: ${fullPath}`, 'INFO');
        
        // Validar que la ruta no intente escapar del directorio del proyecto (medida de seguridad básica)
        if (!fullPath.startsWith(projectRoot)) {
            log(`Intento de escritura fuera del directorio del proyecto denegado: ${filePath}`, 'ERROR');
            return { success: false, error: `Acceso denegado: La ruta del archivo está fuera de los límites permitidos.` };
        }
        
        // Opcional: Crear directorios si no existen (con precaución)
        const dirName = path.dirname(fullPath);
        try {
            await fs.mkdir(dirName, { recursive: true });
            log(`Directorio ${dirName} asegurado/creado.`, 'INFO');
        } catch (mkdirError) {
            log(`Error al crear directorio ${dirName}: ${(mkdirError as Error).message}`, 'ERROR');
            return { success: false, error: `No se pudo crear el directorio base para ${filePath}: ${(mkdirError as Error).message}` };
        }
        
        log(`Escribiendo ${suggestedContent.length} caracteres en ${filePath}.`, 'INFO');
        await fs.writeFile(fullPath, suggestedContent, 'utf-8');
        log(`ARCHIVO ACTUALIZADO: El archivo ${filePath} ha sido actualizado con el contenido sugerido.`, 'INFO');
        return { success: true, newContent: suggestedContent };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido al aplicar el cambio.";
        log(`Error al aplicar el cambio al archivo ${filePath}: ${errorMessage}`, 'ERROR');
        if (error instanceof Error && error.stack) {
            log(`Stack del error de escritura: ${error.stack}`, 'ERROR');
        }
        return { success: false, error: `Error al escribir en ${filePath}: ${errorMessage}` };
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
  modelName: string,
  executionLogs?: string[]
): Promise<AutoFixSuggestionResult> {
   const log = (message: string, level: 'INFO' | 'ERROR' = 'INFO') => {
        const timestampedMessage = `[AutoFix ${level} ${new Date().toISOString()}] ${message}`;
        if (level === 'INFO') console.log(timestampedMessage);
        else console.error(timestampedMessage);
        if (executionLogs) executionLogs.push(timestampedMessage);
    };

  log(`Solicitando sugerencia de auto-corrección para error: "${errorMessage.substring(0,150)}..."`, 'INFO');
  if (!apiKey || !modelName) {
    log("Configuración de API incompleta para auto-corrección.", 'ERROR');
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios para la auto-corrección." };
  }

  const groqOptions: GroqOptions = {
    apiKey,
    modelName,
    timeoutMs: GROQ_API_TIMEOUT_MS, 
  };

  const input: SuggestErrorFixInput = {
    error_message: errorMessage,
    context: "Error ocurrido durante la función AutoUpdate (análisis del propio código de YskCodeAlchemist). Por favor, proporciona un análisis de causa raíz y sugerencias de solución específicas. Si el error es por límites de API, explica cómo mitigar el problema (ej. reducir payloads, ajustar timeouts, fragmentar datos, etc.).",
    groqOptions: groqOptions,
  };

  try {
    const result = await suggestErrorFix(input);
    log("Sugerencia de auto-corrección recibida exitosamente.", 'INFO');
    return { success: true, data: result };
  } catch (error) {
    const specificErrorMessage = error instanceof Error ? error.message : "Error desconocido obteniendo sugerencia.";
    log(`Error obteniendo sugerencia para la corrección: ${specificErrorMessage}`, 'ERROR');
    if (error instanceof Error && error.stack) {
        log(`Stack del error en sugerencia: ${error.stack}`, 'ERROR');
    }
    return { success: false, error: `Falló la obtención de sugerencia para corrección: ${specificErrorMessage}` };
  }
}

