
'use server';

import { analyzeProjectSourceChunk, type ProjectAnalysisResponse, type LLMOptions } from '@/services/groq';
import { suggestErrorFix, type SuggestErrorFixInput, type SuggestErrorFixOutput } from '@/ai/flows/suggest-error-fix-flow';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import simpleGit, { type SimpleGitOptions, type SimpleGit } from 'simple-git';
import os from 'os';
import { LLM_PROVIDERS, type LLMProviderId } from '@/config/llm-config';
import type { AppSourceFile, AppSourceBundleResult } from '@/types/project'; // Import from new location
import { fetchRepositoryContents } from '@/services/git-service'; // Import Git service


interface AutoUpdateAnalysisResult {
  success: boolean;
  data?: ProjectAnalysisResponse;
  error?: string;
  chunksProcessed?: number;
  totalChunks?: number;
  detailedExecutionLogs?: string[];
}

const MAX_CHARS_PER_CHUNK = 3500;
const LLM_API_TIMEOUT_MS_AUTOUPDATE = 60000 * 1; // 1 minute per chunk analysis
const INTER_CHUNK_PROCESSING_DELAY_MS = 7000; // Increased delay to 7 seconds

// Modified to accept AppSourceFile[] directly
export async function handleAutoAnalyzeAppSource(
  sourceFiles: AppSourceFile[], 
  providerId: LLMProviderId,
  apiKey: string,
  modelName: string,
  apiUrl?: string,
  analysisPreferences?: string,
  gitRepoUrl?: string // New optional parameter for Git source
): Promise<AutoUpdateAnalysisResult> {
  const executionLogs: string[] = [];

  const log = (message: string) => {
    const timestampedMessage = `[INFO ${new Date().toISOString()}] ${message}`;
    console.log(timestampedMessage);
    executionLogs.push(timestampedMessage);
  };
  const logDetail = (message: string) => {
    const timestampedMessage = `[DETAIL ${new Date().toISOString()}] ${message}`;
    // console.log(timestampedMessage); 
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
        if (error instanceof Error) {
            errorDetail = error.message;
        } else if (typeof error?.toString === 'function') {
            errorDetail = error.toString();
        }
      }
      fullMessage += ` | Detalle: ${errorDetail}`;

      if (error instanceof Error && error.stack) {
        fullMessage += ` | Stack: ${error.stack.substring(0, 500)}...`;
      }
    }
    console.error(fullMessage);
    executionLogs.push(fullMessage);
  };

  const currentProvider = LLM_PROVIDERS.find(p => p.id === providerId);
  log(`Iniciando análisis del código fuente de la aplicación con proveedor: ${currentProvider?.name || providerId}. ${gitRepoUrl ? `Fuente: Git (${gitRepoUrl})` : 'Fuente: Local'}`);


  if (!currentProvider) {
    const errorMsg = `Proveedor LLM '${providerId}' no encontrado.`;
    logError(errorMsg);
    return { success: false, error: `${errorMsg} Por favor, configúralo en ajustes.`, detailedExecutionLogs: executionLogs };
  }
  if (currentProvider.requiresApiKey && !apiKey) {
    const errorMsg = `Configuración de API incompleta para ${currentProvider.name}. Clave API es obligatoria.`;
    logError(errorMsg);
    return { success: false, error: `${errorMsg} Por favor, configúrala en ajustes.`, detailedExecutionLogs: executionLogs };
  }
  if (!modelName) {
    const errorMsg = `Configuración de API incompleta para ${currentProvider.name}. Nombre de modelo es obligatorio.`;
    logError(errorMsg);
    return { success: false, error: `${errorMsg} Por favor, configúrala en ajustes.`, detailedExecutionLogs: executionLogs };
  }
  log(`Usando modelo: ${modelName}. Preferencias de análisis: ${analysisPreferences || 'Ninguna'}. Timeout por fragmento: ${LLM_API_TIMEOUT_MS_AUTOUPDATE / 1000}s. Retraso entre fragmentos: ${INTER_CHUNK_PROCESSING_DELAY_MS / 1000}s.`);

  let filesToAnalyze = sourceFiles;

  if (gitRepoUrl) {
    log(`Obteniendo código fuente desde Git URL: ${gitRepoUrl}`);
    const gitBundleResult = await fetchRepositoryContents(gitRepoUrl);
    if (!gitBundleResult.success || !gitBundleResult.files || gitBundleResult.files.length === 0) {
      const errorMsg = gitBundleResult.error || "No se pudo obtener el código fuente desde Git para analizar.";
      logError(errorMsg, gitBundleResult.logsBuilt);
      executionLogs.push(...(gitBundleResult.logsBuilt || []));
      return {
        success: false,
        error: errorMsg,
        chunksProcessed: 0,
        totalChunks: 0,
        detailedExecutionLogs: executionLogs
      };
    }
    filesToAnalyze = gitBundleResult.files;
    executionLogs.push(...(gitBundleResult.logsBuilt || []));
    log(`Se obtuvieron ${filesToAnalyze.length} archivos desde Git para procesar.`);
  }


  if (!filesToAnalyze || filesToAnalyze.length === 0) {
    const errorMsg = "No se proporcionó código fuente (lista de archivos vacía) para analizar.";
    logError(errorMsg);
    return {
      success: false,
      error: errorMsg,
      chunksProcessed: 0,
      totalChunks: 0,
      detailedExecutionLogs: executionLogs
    };
  }
  log(`Se recibieron ${filesToAnalyze.length} archivos para procesar.`);

  const chunks: string[] = [];
  let currentChunk = "";
  let currentChunkChars = 0;
  let totalSourceChars = filesToAnalyze.reduce((sum, f) => sum + f.content.length, 0);

  log(`Iniciando división del código fuente en fragmentos. Total de caracteres en ${filesToAnalyze.length} archivos: ${totalSourceChars}. MAX_CHARS_PER_CHUNK: ${MAX_CHARS_PER_CHUNK}.`);

  for (const file of filesToAnalyze) {
    logDetail(`Procesando archivo para fragmentación: ${file.fileName} (${file.content.length} caracteres).`);
    const baseFileName = file.fileName;
    let fileEffectiveContent = file.content;

    const fileMarkerTemplate = `\n\n// --- Archivo: ${baseFileName}{part_info} ---\n\n`;
    const fileMarkerLength = fileMarkerTemplate.replace("{part_info}", "").length;

    if (fileEffectiveContent.length + fileMarkerLength > MAX_CHARS_PER_CHUNK) {
      logDetail(`Archivo ${baseFileName} es demasiado grande (${fileEffectiveContent.length} caracteres) para un solo fragmento, se dividirá.`);
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        logDetail(`Fragmento parcial anterior (${currentChunk.length} caracteres) añadido antes de dividir archivo grande. Contenido (inicio): '${currentChunk.substring(0,100)}...'`);
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
        logDetail(`Archivo ${baseFileName}${partInfo} creado como fragmento No. ${chunks.length}. Tamaño de contenido: ${part.length} caracteres. Contenido (inicio): '${part.substring(0,100)}...'`);
        offset += part.length;
        partIndex++;
      }
      continue; 
    }

    const fileContentMarker = fileMarkerTemplate.replace("{part_info}", "");
    if (currentChunkChars + fileEffectiveContent.length + fileContentMarker.length > MAX_CHARS_PER_CHUNK) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        logDetail(`Fragmento actual No. ${chunks.length} (${currentChunk.length} caracteres) añadido. Contenido (inicio): '${currentChunk.substring(0,100)}...'. Iniciando nuevo fragmento con ${baseFileName}.`);
      }
      currentChunk = fileContentMarker + fileEffectiveContent;
      currentChunkChars = fileEffectiveContent.length + fileContentMarker.length;
    } else {
      currentChunk += fileContentMarker + fileEffectiveContent;
      currentChunkChars += fileEffectiveContent.length + fileContentMarker.length;
    }
    logDetail(`Archivo ${baseFileName} (${fileEffectiveContent.length} caracteres) añadido al fragmento actual. Tamaño actual del fragmento: ${currentChunkChars}. Contenido (inicio): '${currentChunk.substring(0,100)}...'`);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
    logDetail(`Fragmento restante No. ${chunks.length} (${currentChunk.length} caracteres) añadido. Contenido (inicio): '${currentChunk.substring(0,100)}...'`);
  }

  const totalChunks = chunks.length;
  log(`División del código fuente completada. Total de fragmentos generados: ${totalChunks}.`);
  if (chunks.length > 0) {
    chunks.forEach((c, i) => logDetail(`Vista previa Fragmento ${i+1}/${totalChunks} - Tamaño: ${c.length} caracteres. Contenido (inicio): '${c.substring(0,100)}...'`));
  }


  if (totalChunks === 0) {
    logWarn("No se generaron fragmentos de código para analizar. Esto puede ocurrir si no hay archivos o son muy pequeños.");
    return {
      success: true,
      data: { analysisTitle: "Sin Contenido para Analizar", identifiedAreas: [], suggestions: [], overallAssessment: "No se encontraron archivos o contenido para analizar." },
      chunksProcessed: 0,
      totalChunks: 0,
      detailedExecutionLogs: executionLogs
    };
  }

  const allResults: ProjectAnalysisResponse[] = [];
  let processedChunks = 0;

  const llmAPIOptions: LLMOptions = {
    providerId: currentProvider.id,
    apiKey: apiKey,
    modelName: modelName,
    apiUrl: apiUrl || currentProvider.apiUrl,
    timeoutMs: LLM_API_TIMEOUT_MS_AUTOUPDATE
  };

  for (const chunk of chunks) {
    const currentChunkNum = processedChunks + 1;
    log(`[CHUNK_ANALYSIS] Iniciando análisis del fragmento ${currentChunkNum} de ${totalChunks}. Tamaño: ${chunk.length} caracteres.`);
    logDetail(`[CHUNK_ANALYSIS_CONTENT ${currentChunkNum}/${totalChunks}] Contenido del fragmento (primeros 200 caracteres): ${chunk.substring(0,200)}...`);

    try {
      const result = await analyzeProjectSourceChunk(chunk, llmAPIOptions, analysisPreferences);
      allResults.push(result);
      processedChunks++;
      log(`[CHUNK_ANALYSIS_SUCCESS] Fragmento ${currentChunkNum}/${totalChunks} procesado exitosamente.`);
      logDetail(`[CHUNK_ANALYSIS_RESPONSE ${currentChunkNum}/${totalChunks}] Respuesta del LLM (primeros 200 caracteres): ${JSON.stringify(result).substring(0,200)}...`);

      if (processedChunks < totalChunks) {
        log(`[CHUNK_DELAY] Esperando ${INTER_CHUNK_PROCESSING_DELAY_MS / 1000}s antes del siguiente fragmento para gestionar los límites de TPM/RPM.`);
        await new Promise(resolve => setTimeout(resolve, INTER_CHUNK_PROCESSING_DELAY_MS));
      }

    } catch (error) {
      let errorMessage: string;
       if (error instanceof Error) {
          errorMessage = error.message;
      } else {
          errorMessage = typeof error === 'string' ? error : "Ha ocurrido un error desconocido durante el análisis de un fragmento.";
      }
      if (!errorMessage || errorMessage.trim() === "") {
          errorMessage = "Ha ocurrido un error desconocido o el servidor no proporcionó detalles durante el análisis de un fragmento.";
      }
      logError(`[CHUNK_ANALYSIS_ERROR] Error analizando el fragmento ${currentChunkNum}/${totalChunks}.`, error);
      return {
        success: false,
        error: `Falló el análisis del fragmento ${currentChunkNum}: ${errorMessage}`,
        chunksProcessed: processedChunks,
        totalChunks: totalChunks,
        detailedExecutionLogs: executionLogs
      };
    }
  }

  if (allResults.length === 0 && totalChunks > 0) {
     const errorMsg = "No se obtuvieron resultados del análisis de los fragmentos, aunque se procesaron algunos o todos.";
    logError(errorMsg);
    return {
        success: false,
        error: errorMsg,
        chunksProcessed: processedChunks,
        totalChunks: totalChunks,
        detailedExecutionLogs: executionLogs
    };
  }
  log(`Análisis de todos los ${processedChunks} fragmentos completado. Agregando resultados...`);

  const aggregatedResult: ProjectAnalysisResponse = {
    analysisTitle: allResults.length > 0 && allResults[0].analysisTitle ? `${allResults[0].analysisTitle} (Agregado de ${totalChunks} fragmentos)` : `Análisis Agregado de ${totalChunks} Fragmentos`,
    identifiedAreas: Array.from(new Set(allResults.flatMap(r => r.identifiedAreas || []))),
    suggestions: allResults.flatMap(r => (r.suggestions || []).map(s => ({...s, area: s.area || "General (Fragmento)" }))),
    overallAssessment: allResults.map(r => r.overallAssessment || "").filter(a => a.trim() !== "").join('\n\n---\n\n') || "No se generó una evaluación general agregada.",
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


const ignorePatterns = [
  'node_modules/**',
  '.next/**',
  '*.zip',
  // '*.json', // Keep package.json, tsconfig.json etc.
  '.DS_Store',
  '*.log',
  'build/**',
  'dist/**',
  '.env', 
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.git/**',
  'public/generated/**', 
  // '*.lock', // Keep lock files for reproducibility
];


export async function getApplicationSourceBundle(
  concatenate: boolean = false,
  parentExecutionLogs?: string[],
  gitRepoUrl?: string // New optional parameter for Git source
): Promise<AppSourceBundleResult> {
  const internalLogs: string[] = [];
  const log = (message: string, level: 'INFO' | 'DETAIL' | 'WARN' | 'ERROR' = 'INFO') => {
    const timestampedMessage = `[SourceBundle ${level} ${new Date().toISOString()}] ${message}`;
    switch(level) {
        case 'INFO': console.log(timestampedMessage); break;
        case 'DETAIL': console.log(timestampedMessage); break; 
        case 'WARN': console.warn(timestampedMessage); break;
        case 'ERROR': console.error(timestampedMessage); break;
    }
    internalLogs.push(timestampedMessage);
    if (parentExecutionLogs) parentExecutionLogs.push(timestampedMessage);
  };

  if (gitRepoUrl) {
    log(`Obteniendo paquete de código fuente desde Git URL: ${gitRepoUrl}`, 'INFO');
    const gitResult = await fetchRepositoryContents(gitRepoUrl, undefined, ignorePatterns);
    // Prepend git-service logs to current function's logs
    if (gitResult.logsBuilt) internalLogs.unshift(...gitResult.logsBuilt);
    
    if (!gitResult.success || !gitResult.files) {
      log(`Error obteniendo contenido de Git: ${gitResult.error}`, 'ERROR');
      return { success: false, error: gitResult.error || "Fallo al obtener contenido de Git.", logsBuilt: internalLogs };
    }
    if (concatenate) {
      // fetchRepositoryContents already provides concatenatedSource
      return { success: true, files: gitResult.files, concatenatedSource: gitResult.concatenatedSource, logsBuilt: internalLogs };
    }
    return { success: true, files: gitResult.files, logsBuilt: internalLogs };
  }

  // --- Original local file fetching logic ---
  log("Iniciando obtención del paquete de código fuente de la aplicación (local).", 'INFO');
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
    allFiles.forEach(f => log(`Archivo encontrado por glob: ${f}`, 'DETAIL'));


    if (allFiles.length === 0) {
        log("No se encontraron archivos después de aplicar patrones de ignorados. Verifique los patrones o el contenido del proyecto.", 'WARN');
        return { success: false, error: "No se encontraron archivos para empaquetar.", logsBuilt: internalLogs };
    }

    const filesData: AppSourceFile[] = [];
    let concatenatedContent = "";

    for (const relativeFilePath of allFiles) {
      let fullPath: string;
      try {
        fullPath = path.join(projectRoot, relativeFilePath);
        log(`Procesando archivo para empaquetar: ${relativeFilePath}`, 'DETAIL');
        const stats = await fs.stat(fullPath);
        log(`Estadísticas para ${relativeFilePath}: tamaño ${stats.size} bytes.`, 'DETAIL');

        if (concatenate && stats.size > 500 * 1024) { 
            log(`Archivo omitido de la concatenación por tamaño excesivo: ${relativeFilePath} (${(stats.size / 1024).toFixed(2)} KB)`, 'WARN');
            const message = `// Archivo ${relativeFilePath} omitido de la concatenación por ser demasiado grande (${(stats.size / 1024).toFixed(2)} KB).\n`;
            concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${message}`;
             if (!concatenate) filesData.push({ fileName: relativeFilePath, content: "// Archivo omitido por tamaño excesivo." });
            continue;
        }

        let content: string;
        try {
          log(`Intentando leer contenido de ${fullPath}...`, 'DETAIL');
          content = await fs.readFile(fullPath, 'utf-8');
          log(`Contenido de ${relativeFilePath} leído exitosamente. Longitud: ${content.length}`, 'DETAIL');
        } catch (readError) {
          const error = readError as NodeJS.ErrnoException;
          if (error.code === 'EACCES' || error.code === 'ENOENT' || error.code === 'EISDIR') {
              log(`Acceso/Permiso denegado o archivo no encontrado/es directorio para ${relativeFilePath}: ${error.message}. Omitiendo.`, 'DETAIL');
              continue; 
          } else {
              log(`No se pudo leer el archivo ${relativeFilePath} como texto (podría ser binario o error desconocido): ${error.message}. Código: ${error.code}`, 'WARN');
              content = `// Error: No se pudo leer el archivo ${relativeFilePath} como texto. Causa: ${error.message}.`;
              filesData.push({ fileName: relativeFilePath, content: content });
               if (concatenate) {
                 concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
               }
              continue;
          }
        }

        filesData.push({ fileName: relativeFilePath, content });
        if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
          log(`Contenido de ${relativeFilePath} añadido a la concatenación. Nueva longitud total concatenada (aprox): ${concatenatedContent.length}`, 'DETAIL');
        }
      } catch (fileProcessingError) {
        const error = fileProcessingError as NodeJS.ErrnoException;
        if (error.code !== 'EACCES' && error.code !== 'EISDIR' && error.code !== 'ENOENT') {
            log(`Error al procesar el archivo ${relativeFilePath} para el paquete fuente: ${error.message}. Código: ${error.code}`, 'WARN');
        } else {
            log(`Error de acceso/directorio omitido para ${relativeFilePath}: ${error.message}. Código: ${error.code}`, 'DETAIL');
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
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = typeof error === 'string' ? error : "Ha ocurrido un error desconocido durante la operación.";
    }
    if (!errorMessage || errorMessage.trim() === "") {
        errorMessage = "Ha ocurrido un error desconocido o el servidor no proporcionó detalles.";
    }

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
    originalContent: string, 
    suggestedContent: string,
    executionLogs?: string[]
): Promise<{success: boolean, error?: string, newContent?: string}> {
    const log = (message: string, level: 'INFO' | 'ERROR' | 'DETAIL' = 'INFO') => {
        const timestampedMessage = `[ApplyChange ${level} ${new Date().toISOString()}] ${message}`;
        if (level === 'INFO') console.log(timestampedMessage);
        else if (level === 'ERROR') console.error(timestampedMessage);
        else console.log(timestampedMessage); 
        if (executionLogs) executionLogs.push(timestampedMessage);
    };

    log(`Intentando aplicar cambio al archivo: ${filePath}`, 'INFO');

    let fullPath: string;
    try {
        const projectRoot = process.cwd();
        fullPath = path.resolve(projectRoot, filePath); 
        log(`Ruta absoluta del archivo para escritura: ${fullPath}`, 'DETAIL');

        if (!fullPath.startsWith(projectRoot + path.sep) && fullPath !== projectRoot) {
            log(`Intento de escritura fuera del directorio del proyecto denegado: ${filePath} (Resuelto a: ${fullPath})`, 'ERROR');
            return { success: false, error: `Acceso denegado: La ruta del archivo está fuera de los límites permitidos.` };
        }

        const dirName = path.dirname(fullPath);
        log(`Asegurando que el directorio existe: ${dirName}`, 'DETAIL');
        await fs.mkdir(dirName, { recursive: true });
        log(`Directorio ${dirName} asegurado/creado.`, 'INFO');

        log(`Escribiendo ${suggestedContent.length} caracteres en ${filePath}.`, 'DETAIL');
        await fs.writeFile(fullPath, suggestedContent, 'utf-8');
        log(`ARCHIVO ACTUALIZADO: El archivo ${filePath} ha sido actualizado con el contenido sugerido.`, 'INFO');
        return { success: true, newContent: suggestedContent };

    } catch (error) {
        let errorMessage: string;
        if (error instanceof Error) {
            errorMessage = error.message;
            if (error.stack) log(`Stack del error de escritura: ${error.stack}`, 'ERROR');
        } else {
            errorMessage = typeof error === 'string' ? error : "Ha ocurrido un error desconocido durante la operación.";
        }
        if (!errorMessage || errorMessage.trim() === "") {
            errorMessage = "Ha ocurrido un error desconocido o el servidor no proporcionó detalles al aplicar el cambio.";
        }
        log(`Error al aplicar el cambio al archivo ${filePath}: ${errorMessage}`, 'ERROR');
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
  providerId: LLMProviderId,
  apiKey: string,
  modelName: string,
  apiUrl?: string,
  executionLogs?: string[],
  customContext?: string
): Promise<AutoFixSuggestionResult> {
   const log = (message: string, level: 'INFO' | 'ERROR' = 'INFO') => {
        const timestampedMessage = `[AutoFix ${level} ${new Date().toISOString()}] ${message}`;
        if (level === 'INFO') console.log(timestampedMessage);
        else console.error(timestampedMessage);
        if (executionLogs) executionLogs.push(timestampedMessage);
    };

  const currentProvider = LLM_PROVIDERS.find(p => p.id === providerId);
  log(`Solicitando sugerencia de auto-corrección para error: "${errorMessage.substring(0,150)}..." con proveedor ${currentProvider?.name || providerId}`, 'INFO');

  if (!currentProvider) {
    const errorMsg = `Proveedor LLM '${providerId}' no encontrado para auto-corrección.`;
    log(errorMsg, 'ERROR');
    return { success: false, error: errorMsg };
  }
  if (currentProvider.requiresApiKey && !apiKey) {
    const errorMsg = `Configuración de API incompleta para auto-corrección con ${currentProvider.name}. Falta la clave API.`;
    log(errorMsg, 'ERROR');
    return { success: false, error: errorMsg };
  }
   if (!modelName) {
    const errorMsg = `Nombre de modelo no proporcionado para auto-corrección con ${currentProvider.name}.`;
    log(errorMsg, 'ERROR');
    return { success: false, error: errorMsg };
  }

  const llmOptions: LLMOptions = { 
    providerId: currentProvider.id,
    apiKey,
    modelName,
    apiUrl: apiUrl || currentProvider.apiUrl,
    timeoutMs: LLM_API_TIMEOUT_MS_AUTOUPDATE, 
  };

  const contextForIA = customContext || "Error ocurrido durante la función AutoUpdate (análisis del propio código de CodeAlchemist). Por favor, proporciona un análisis de causa raíz y sugerencias de solución específicas. Si el error es por límites de API, explica cómo mitigar el problema (ej. reducir payloads, ajustar timeouts, fragmentar datos, etc.).";
  log(`Contexto para la IA (AutoFix): "${contextForIA.substring(0,100)}..."`, 'INFO');

  const input: SuggestErrorFixInput = {
    error_message: errorMessage,
    context: contextForIA,
    llmOptions: llmOptions, 
  };

  const operationName = `la obtención de sugerencia para corrección con ${currentProvider.name}`;
  try {
    const result = await suggestErrorFix(input); 
    log("Sugerencia de auto-corrección recibida exitosamente.", 'INFO');
    return { success: true, data: result };
  } catch (error) {
    let specificErrorMessage: string;
    if (error instanceof Error) {
        specificErrorMessage = error.message;
        if (error.stack) log(`Stack del error en sugerencia: ${error.stack}`, 'ERROR');
    } else {
        specificErrorMessage = typeof error === 'string' ? error : "Ha ocurrido un error desconocido durante la operación.";
    }
    if (!specificErrorMessage || specificErrorMessage.trim() === "") {
        specificErrorMessage = "Ha ocurrido un error desconocido o el servidor no proporcionó detalles al obtener sugerencia.";
    }
    log(`Error obteniendo sugerencia para la corrección con ${currentProvider.name}: ${specificErrorMessage}`, 'ERROR');
    return { success: false, error: `Falló ${operationName}: ${specificErrorMessage}` };
  }
}


interface GitUploadConfig {
    repoUrl: string;
    username: string;
    email: string;
    pat: string;
}

interface GitUploadResult {
    success: boolean;
    message: string;
    logs?: string[];
}

export async function handleUploadToGit(
    gitConfig: GitUploadConfig,
    commitMessage: string,
    parentExecutionLogs?: string[]
): Promise<GitUploadResult> {
    const internalLogs: string[] = [];
    const log = (message: string, level: 'INFO' | 'DETAIL' | 'WARN' | 'ERROR' = 'INFO') => {
        const timestampedMessage = `[GitUpload ${level} ${new Date().toISOString()}] ${message}`;
        if (level !== 'DETAIL') { 
             console.log(timestampedMessage);
        }
        internalLogs.push(timestampedMessage);
        if (parentExecutionLogs) parentExecutionLogs.push(timestampedMessage);
    };

    const redactedRepoUrl = gitConfig.repoUrl.replace(gitConfig.pat, '********');
    log(`Iniciando subida a Git para el repositorio: ${redactedRepoUrl}. Commit: "${commitMessage}"`, 'INFO');

    if (!gitConfig.repoUrl || !gitConfig.username || !gitConfig.email || !gitConfig.pat) {
        const errMsg = "Configuración de Git incompleta. Se requieren URL, nombre de usuario, email y PAT.";
        log(errMsg, 'ERROR');
        return { success: false, message: errMsg, logs: internalLogs };
    }

    let tempRepoPath: string | undefined;
    const defaultBranch = 'main'; 

    try {
        log("Paso 1: Obteniendo el paquete de código fuente más reciente...", 'INFO');
        const sourceBundle = await getApplicationSourceBundle(false, internalLogs); // false = no concatenar
        if (!sourceBundle.success || !sourceBundle.files || sourceBundle.files.length === 0) {
            const errorMsg = sourceBundle.error || "No se pudo obtener el código fuente para subir a Git.";
            log(errorMsg, 'ERROR');
            return { success: false, message: errorMsg, logs: internalLogs };
        }
        log(`Paquete de código fuente obtenido con ${sourceBundle.files.length} archivos.`, 'INFO');

        log("Paso 2: Creando un directorio temporal para el repositorio...", 'DETAIL');
        tempRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codealchemist-gitsync-'));
        log(`Directorio temporal creado: ${tempRepoPath}`, 'INFO');

        const gitOptions: Partial<SimpleGitOptions> = {
            baseDir: tempRepoPath,
            binary: 'git',
            maxConcurrentProcesses: 1,
        };
        const git: SimpleGit = simpleGit(gitOptions);

        log("Paso 3: Inicializando repositorio Git...", 'INFO');
        await git.init();
        log("Repositorio Git inicializado.", 'INFO');

        log(`Paso 3.1: Asegurando que la rama local sea '${defaultBranch}'...`, 'INFO');
        try {
            await git.checkoutLocalBranch(defaultBranch);
            log(`Rama local '${defaultBranch}' creada o ya existente.`, 'INFO');
        } catch (branchError: any) {
            if (branchError.message && branchError.message.includes('already exists')) {
                log(`La rama local '${defaultBranch}' ya existe. Intentando cambiar a ella.`, 'DETAIL');
                try {
                    await git.checkout(defaultBranch);
                    log(`Cambiado a la rama local existente '${defaultBranch}'.`, 'INFO');
                } catch (checkoutError: any) {
                    log(`Error al cambiar a la rama '${defaultBranch}': ${checkoutError.message}`, 'ERROR');
                    throw checkoutError; 
                }
            } else if (branchError.message && branchError.message.includes('is not a commit')) {
                log(`El repositorio está vacío. La rama '${defaultBranch}' se creará en el primer commit.`, 'INFO');
            }
             else {
                log(`Error inesperado al gestionar la rama '${defaultBranch}': ${branchError.message}`, 'ERROR');
                throw branchError;
            }
        }


        log("Paso 4: Configurando usuario y email de Git...", 'INFO');
        await git.addConfig('user.name', gitConfig.username);
        await git.addConfig('user.email', gitConfig.email);
        log(`Usuario Git configurado como "${gitConfig.username}" <${gitConfig.email}>`, 'INFO');

        log(`Paso 5: Copiando ${sourceBundle.files.length} archivos al repositorio temporal...`, 'DETAIL');
        for (const file of sourceBundle.files) {
           const filePath = path.join(tempRepoPath, file.fileName);
           const dirForFile = path.dirname(filePath);
           try {
               await fs.mkdir(dirForFile, { recursive: true });
               await fs.writeFile(filePath, file.content, 'utf-8');
               log(`Archivo copiado: ${file.fileName}`, 'DETAIL');
           } catch(writeError: any) {
               log(`Error al escribir el archivo ${file.fileName} en el repositorio temporal: ${writeError.message}`, 'WARN');
           }
        }
        log("Archivos copiados al repositorio temporal.", 'INFO');

        log("Paso 6: Añadiendo todos los archivos al staging de Git...", 'INFO');
        await git.add('./*');
        log("Archivos añadidos al staging.", 'INFO');

        log(`Paso 7: Realizando commit con mensaje: "${commitMessage}"`, 'INFO');
        const commitResult = await git.commit(commitMessage);

        if (!commitResult.commit && commitResult.summary.changes === 0) {
             log("No hay cambios para hacer commit. La subida a Git se considera exitosa sin push.", 'WARN');
             return { success: true, message: "No se detectaron cambios en el código fuente para subir a Git.", logs: internalLogs };
        }
        log(`Commit realizado. SHA: ${commitResult.commit || 'N/A'}. Resumen: ${commitResult.summary.changes} cambios, ${commitResult.summary.insertions} inserciones, ${commitResult.summary.deletions} eliminaciones.`, 'INFO');

        log("Paso 8: Configurando repositorio remoto 'origin'...", 'INFO');
        const authenticatedRepoUrl = gitConfig.repoUrl.replace("https://", `https://${encodeURIComponent(gitConfig.username)}:${encodeURIComponent(gitConfig.pat)}@`);

        const remotes = await git.getRemotes(true);
        if (remotes.find(r => r.name === 'origin')) {
            await git.remote(['set-url', 'origin', authenticatedRepoUrl]);
            log(`URL del remoto 'origin' actualizada.`, 'INFO');
        } else {
            await git.addRemote('origin', authenticatedRepoUrl);
            log(`Remoto 'origin' añadido.`, 'INFO');
        }
        log(`Repositorio remoto 'origin' configurado para ${redactedRepoUrl}`, 'INFO');

        log(`Paso 9: Realizando push a la rama remota '${defaultBranch}'...`, 'INFO');
        await git.push(['-u', 'origin', defaultBranch, '--force']);
        log(`Push a la rama '${defaultBranch}' completado.`, 'INFO');

        const successMsg = `Subida a Git completada exitosamente al repositorio ${redactedRepoUrl}.`;
        log(successMsg, 'INFO');
        return { success: true, message: successMsg, logs: internalLogs };

    } catch (error: any) {
        let errorMsg = "Error desconocido durante la subida a Git.";
        let errorDetails = error instanceof Error ? error.stack || "" : '';

        if (error.message) {
             errorMsg = error.message;
             if (error.message.includes("Authentication failed")) {
                 errorMsg = "Falló la autenticación Git. Verifica tu nombre de usuario y PAT.";
             } else if (error.message.includes("repository not found")) {
                 errorMsg = "Repositorio Git no encontrado. Verifica la URL.";
             } else if (error.message.includes("src refspec") && error.message.includes("does not match any")) {
                 errorMsg = `La rama local '${defaultBranch}' no existe o no coincide con ninguna rama remota. Verifica el nombre de la rama.`;
             } else if (error.message.includes("could not read Username")) {
                  errorMsg = "Falló la autenticación Git (no se pudo leer el nombre de usuario). Verifica tu PAT y permisos.";
             }
        }
        
        if (!errorMsg || errorMsg.trim() === "") {
            errorMsg = "Ha ocurrido un error desconocido o el servidor no proporcionó detalles durante la subida a Git.";
        }


        log(`Error crítico durante la subida a Git: ${errorMsg}`, 'ERROR');
        if (errorDetails) {
            log(`Stack/Detalles del error de Git: ${errorDetails}`, 'ERROR');
        }

        return { success: false, message: `Falló la subida a Git: ${errorMsg}`, logs: internalLogs };
    } finally {
        if (tempRepoPath) {
            log(`Paso 10: Limpiando directorio temporal ${tempRepoPath}...`, 'INFO');
            try {
                await fs.rm(tempRepoPath, { recursive: true, force: true });
                log("Directorio temporal eliminado.", 'INFO');
            } catch (cleanupError: any) {
                log(`Error al limpiar el directorio temporal ${tempRepoPath}: ${cleanupError.message}`, 'ERROR');
            }
        }
    }
}


