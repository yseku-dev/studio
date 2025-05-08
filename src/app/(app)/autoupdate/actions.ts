
'use server';

import { analyzeCodeAlchemistSource, AnalyzeCodeAlchemistSourceInput, AnalyzeCodeAlchemistSourceOutput } from '@/ai/flows/analyze-codealchemist-source-flow';
import { suggestErrorFix, SuggestErrorFixInput, SuggestErrorFixOutput } from '@/ai/flows/suggest-error-fix-flow';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob'; 
import type { GroqOptions } from '@/services/groq';
import simpleGit, { SimpleGitOptions } from 'simple-git';
import os from 'os'; // For temporary directory

interface AutoUpdateAnalysisResult {
  success: boolean;
  data?: AnalyzeCodeAlchemistSourceOutput;
  error?: string;
  chunksProcessed?: number;
  totalChunks?: number;
  detailedExecutionLogs?: string[];
}

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
        } else if (typeof error.toString === 'function') {
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
    const fileMarkerLength = fileMarkerTemplate.replace("{part_info}", "").length;

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
      success: true, 
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
  logsBuilt?: string[];
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
  '.git/**', 
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
        case 'DETAIL': console.log(timestampedMessage); break; // Keep details for verbosity
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
            filesData.push({ fileName: relativeFilePath, content: message });
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
           if (!concatenate && (error.code === 'EILSEQ' || stats.size > 1024 * 1024 * 2) ) { // 2MB limit for non-concatenated files
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
        if (error.code !== 'EACCES' && error.code !== 'EISDIR' && error.code !== 'ENOENT') { 
            log(`Error al procesar el archivo ${relativeFilePath} para el paquete fuente: ${error.message}. Código: ${error.code}`, 'WARN');
        } else {
            log(`Error de acceso/directorio omitido para ${relativeFilePath}: ${error.message}. Código: ${error.code}`, 'DETAIL');
        }
        const errorMessage = `// Error: No se pudo procesar completamente el archivo ${relativeFilePath}. Causa: ${error.message}`;
        filesData.push({ fileName: relativeFilePath, content: errorMessage });
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
    originalContent: string, // originalContent is not used if we are overwriting, but good for logging/diffing before write.
    suggestedContent: string,
    executionLogs?: string[]
): Promise<{success: boolean, error?: string, newContent?: string}> {
    const log = (message: string, level: 'INFO' | 'ERROR' = 'INFO') => {
        const timestampedMessage = `[ApplyChange ${level} ${new Date().toISOString()}] ${message}`;
        if (level === 'INFO') console.log(timestampedMessage);
        else console.error(timestampedMessage);
        if (executionLogs) executionLogs.push(timestampedMessage);
    };

    log(`Intentando aplicar cambio al archivo: ${filePath}`, 'INFO');
    
    // No simulation - actual file system operations
    try {
        const projectRoot = process.cwd();
        const fullPath = path.join(projectRoot, filePath);

        log(`Ruta completa del archivo para escritura: ${fullPath}`, 'INFO');
        
        // Security check: ensure the path is within the project directory
        if (!fullPath.startsWith(projectRoot)) {
            log(`Intento de escritura fuera del directorio del proyecto denegado: ${filePath}`, 'ERROR');
            return { success: false, error: `Acceso denegado: La ruta del archivo está fuera de los límites permitidos.` };
        }
        
        // Ensure directory exists
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
  executionLogs?: string[],
  customContext?: string // Parámetro opcional para contexto personalizado
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

  // Usar customContext si se proporciona, de lo contrario usar el contexto por defecto.
  const contextForIA = customContext || "Error ocurrido durante la función AutoUpdate (análisis del propio código de CodeAlchemist). Por favor, proporciona un análisis de causa raíz y sugerencias de solución específicas. Si el error es por límites de API, explica cómo mitigar el problema (ej. reducir payloads, ajustar timeouts, fragmentar datos, etc.).";
  log(`Contexto para la IA (AutoFix): "${contextForIA.substring(0,100)}..."`, 'INFO');

  const input: SuggestErrorFixInput = {
    error_message: errorMessage,
    context: contextForIA,
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
    commitMessage: string = "CodeAlchemist: AutoUpdate Sync",
    parentExecutionLogs?: string[]
): Promise<GitUploadResult> {
    const internalLogs: string[] = [];
    const log = (message: string, level: 'INFO' | 'DETAIL' | 'WARN' | 'ERROR' = 'INFO') => {
        const timestampedMessage = `[GitUpload ${level} ${new Date().toISOString()}] ${message}`;
        console.log(timestampedMessage); // Log all git operations for debugging
        internalLogs.push(timestampedMessage);
        if (parentExecutionLogs) parentExecutionLogs.push(timestampedMessage);
    };
    
    log(`Iniciando subida a Git para el repositorio: ${gitConfig.repoUrl.replace(gitConfig.pat, '********')}`, 'INFO');

    if (!gitConfig.repoUrl || !gitConfig.username || !gitConfig.email || !gitConfig.pat) {
        const errMsg = "Configuración de Git incompleta. Se requieren URL, nombre de usuario, email y PAT.";
        log(errMsg, 'ERROR');
        return { success: false, message: errMsg, logs: internalLogs };
    }

    let tempRepoPath: string | undefined;
    const defaultBranch = 'main'; 

    try {
        log("Paso 1: Obtener el paquete de código fuente más reciente...", 'INFO');
        const sourceBundle = await getApplicationSourceBundle(false, internalLogs);
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
        const git = simpleGit(gitOptions);

        log("Paso 3: Inicializando repositorio Git...", 'INFO');
        await git.init();
        log("Repositorio Git inicializado.", 'INFO');

        // Asegurar que la rama actual sea defaultBranch (ej. 'main')
        log(`Paso 3.1: Asegurando que la rama local sea '${defaultBranch}'...`, 'INFO');
        const currentBranchSummary = await git.branchLocal();
        if (currentBranchSummary.current !== defaultBranch) {
            if (currentBranchSummary.all.includes(defaultBranch)) { // Si 'main' existe pero no es la actual
                 await git.checkout(defaultBranch);
                 log(`Cambiado a la rama local existente '${defaultBranch}'.`, 'INFO');
            } else { // Si 'main' no existe localmente, renombrar la actual (que podría ser 'master')
                 await git.branch(['-M', defaultBranch]);
                 log(`Rama actual renombrada a '${defaultBranch}'.`, 'INFO');
            }
        } else {
            log(`La rama local actual ya es '${defaultBranch}'.`, 'INFO');
        }


        log("Paso 4: Configurando usuario y email de Git...", 'INFO');
        await git.addConfig('user.name', gitConfig.username);
        await git.addConfig('user.email', gitConfig.email);
        log(`Usuario Git configurado como "${gitConfig.username}" <${gitConfig.email}>`, 'INFO');

        log(`Paso 5: Copiando ${sourceBundle.files.length} archivos al repositorio temporal...`, 'DETAIL');
        for (const file of sourceBundle.files) {
           const filePath = path.join(tempRepoPath, file.fileName);
           const dirForFile = path.dirname(filePath);
           await fs.mkdir(dirForFile, { recursive: true });
           await fs.writeFile(filePath, file.content, 'utf-8');
           // log(`Archivo copiado a ${filePath}`, 'DETAIL'); // Demasiado verboso
        }
        log("Archivos copiados al repositorio temporal.", 'INFO');

        log("Paso 6: Añadiendo todos los archivos al staging de Git...", 'INFO');
        await git.add('./*'); // Add all files in the temp directory
        log("Archivos añadidos al staging.", 'INFO');

        log(`Paso 7: Realizando commit con mensaje: "${commitMessage}"`, 'INFO');
        const commitResult = await git.commit(commitMessage);

        if (!commitResult.commit && commitResult.summary.changes === 0) { // No commit SHA and no changes
             log("No hay cambios para hacer commit. La subida a Git se considera exitosa sin push.", 'WARN');
             return { success: true, message: "No se detectaron cambios en el código fuente para subir a Git.", logs: internalLogs };
        }
        log(`Commit realizado. SHA: ${commitResult.commit || 'N/A'}. Resumen: ${commitResult.summary.changes} cambios, ${commitResult.summary.insertions} inserciones, ${commitResult.summary.deletions} eliminaciones.`, 'INFO');


        log("Paso 8: Configurando repositorio remoto 'origin'...", 'INFO');
        const authenticatedRepoUrl = gitConfig.repoUrl.replace("https://", `https://${encodeURIComponent(gitConfig.username)}:${encodeURIComponent(gitConfig.pat)}@`);
        
        // En un repo temporal nuevo, siempre añadimos el remote, no necesitamos set-url.
        await git.addRemote('origin', authenticatedRepoUrl);
        log(`Repositorio remoto 'origin' añadido y configurado para ${gitConfig.repoUrl.replace(gitConfig.pat, '********')}`, 'INFO');
        
        log(`Paso 9: Realizando push a la rama '${defaultBranch}'...`, 'INFO');
        // Usar -u para establecer upstream y crear la rama en el remoto si no existe.
        await git.push(['-u', 'origin', defaultBranch]); 
        log(`Push a la rama '${defaultBranch}' completado.`, 'INFO');

        const successMsg = `Subida a Git completada exitosamente al repositorio ${gitConfig.repoUrl.replace(gitConfig.pat, '********')}.`;
        log(successMsg, 'INFO');
        return { success: true, message: successMsg, logs: internalLogs };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Error desconocido durante la subida a Git.";
        log(`Error crítico durante la subida a Git: ${errorMsg}`, 'ERROR');
        if (error instanceof Error && (error as any).stack) { // simple-git errors might have stack
            log(`Stack del error de Git: ${(error as any).stack}`, 'ERROR');
        }
        return { success: false, message: `Falló la subida a Git: ${errorMsg}`, logs: internalLogs };
    } finally {
        if (tempRepoPath) {
            log(`Paso 10: Limpiando directorio temporal ${tempRepoPath}...`, 'INFO');
            try {
                await fs.rm(tempRepoPath, { recursive: true, force: true });
                log("Directorio temporal eliminado.", 'INFO');
            } catch (cleanupError) {
                log(`Error al limpiar el directorio temporal ${tempRepoPath}: ${(cleanupError as Error).message}`, 'ERROR');
            }
        }
    }
}


    


